import { z } from "zod";
import { boundedBytes, HttpError } from "../http";
import type { Job, Preferences } from "../schema";
import { safeExternalUrl } from "../utils";
import { boardKey, boardSchema, catalog, type Board } from "./catalog";
import { linkedInSearchSchema, type LinkedInSearch } from "./linkedin";
import { isLinkedInHost, linkedInListUrl, linkedInPostingUrl, parseLinkedInDetail, parseLinkedInList } from "./linkedin-public";
import { deduplicate, normalizeJob } from "./normalize";

const maxResponse = 8 * 1024 * 1024;
const cacheDuration = 5 * 60_000;
const staleDuration = 30 * 60_000;
const maxParallel = 4;
const timeout = 6500;
const cache = new Map<string,{jobs:Job[]; freshUntil:number; staleUntil:number}>();
const cooldown = new Map<string,number>();
const pending = new Map<string,Promise<Job[]>>();
const ashbyList = z.object({jobs:z.array(z.unknown()).max(2500)});
const greenhouseList = z.object({jobs:z.array(z.unknown()).max(2500)});
const leverList = z.array(z.unknown()).max(2500);

type Connector = {
  listUrl: (board:Board, offset?:number) => string;
  pageSize?: number;
  parseList: (data:unknown) => unknown[];
  detailUrl?: (board:Board,id:string) => string;
};

const greenhouseBase = (board:Board) => `https://boards-api.greenhouse.io/v1/boards/${board.slug}`;
const leverBase = (board:Board) => `https://api${board.region === "eu" ? ".eu" : ""}.lever.co/v0/postings/${board.slug}`;
const connectors: Record<Board["source"],Connector> = {
  greenhouse:{
    listUrl:board=>`${greenhouseBase(board)}/jobs?content=true`,
    parseList:data=>greenhouseList.parse(data).jobs,
    detailUrl:(board,id)=>`${greenhouseBase(board)}/jobs/${id}?pay_transparency=true`,
  },
  lever:{
    listUrl:(board,offset=0)=>`${leverBase(board)}?mode=json&limit=100&skip=${offset}`,
    pageSize:100,
    parseList:data=>leverList.parse(data),
    detailUrl:(board,id)=>`${leverBase(board)}/${id}?mode=json`,
  },
  ashby:{
    listUrl:board=>`https://api.ashbyhq.com/posting-api/job-board/${board.slug}?includeCompensation=true`,
    parseList:data=>ashbyList.parse(data).jobs,
  },
};

const apiHosts = new Set(["api.lever.co","api.eu.lever.co","boards-api.greenhouse.io","api.ashbyhq.com"]);
let active = 0;
const waiters: (()=>void)[] = [];

async function acquireSlot(signal: AbortSignal) {
  signal.throwIfAborted();
  if (active < maxParallel) {
    active++;
    return;
  }
  if (waiters.length >= 28) throw new HttpError(503,"PROVIDER_BUSY","Os provedores estão ocupados. Tente novamente em instantes.");
  await new Promise<void>((resolve,reject)=>{
    function ready() {
      signal.removeEventListener("abort",cancel);
      resolve();
    }
    function cancel() {
      waiters.splice(waiters.indexOf(ready),1);
      reject(signal.reason);
    }
    waiters.push(ready);
    signal.addEventListener("abort",cancel,{once:true});
  });
}

async function fetchPublic(url: string, deadline: AbortSignal, linkedInId?: string) {
  const host = new URL(url).hostname;
  const linkedIn = isLinkedInHost(host);
  const key = linkedIn ? "linkedin.com" : host;
  if (!linkedIn && !apiHosts.has(key)) throw new Error("Provider host");
  await acquireSlot(deadline);
  try {
    const blockedUntil = cooldown.get(key) ?? 0;
    if (blockedUntil > Date.now()) throw new HttpError(429,"PROVIDER_RATE","Limite temporário da fonte.");
    const options = {
      cache:"no-store",headers:{Accept:linkedIn ? "text/html" : "application/json"},
      signal:AbortSignal.any([deadline,AbortSignal.timeout(timeout)]),
    } as const;
    let response = await fetch(url,{...options,redirect:linkedInId ? "manual" : "error"});
    if (linkedInId && [301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(()=>undefined);
      const redirected = location && linkedInPostingUrl(linkedInId,location);
      if (!redirected) throw new Error("LinkedIn redirect");
      url = redirected;
      response = await fetch(url,{...options,redirect:"error"});
    }
    if (!response.ok) {
      await response.body?.cancel().catch(()=>undefined);
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const retryMs = retryAfter && /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000
          : (retryAfter ? Date.parse(retryAfter) - Date.now() : NaN);
        cooldown.set(key, Date.now() + (Number.isFinite(retryMs) ? Math.min(15*60_000,Math.max(20_000,retryMs)) : 60_000));
      }
      throw new HttpError(response.status,"PROVIDER_HTTP","A fonte não retornou os dados da vaga.");
    }
    const data = await boundedBytes(response,linkedIn ? 1024*1024 : maxResponse);
    return {body:new TextDecoder().decode(data),url};
  } finally {
    const next = waiters.shift();
    if (next) next();
    else active--;
  }
}

async function fetchProvider(url: string, deadline = AbortSignal.timeout(12_000)) {
  const {body} = await fetchPublic(url,deadline);
  return JSON.parse(body) as unknown;
}

async function listRows(board: Board, connector: Connector) {
  const deadline = AbortSignal.timeout(24_000);
  const first = connector.parseList(await fetchProvider(connector.listUrl(board),deadline));
  if (!connector.pageSize || first.length < connector.pageSize) return first;
  const size = connector.pageSize;
  const rows = [...first];
  for (let offset=size; offset<600; offset+=size) {
    const page = connector.parseList(await fetchProvider(connector.listUrl(board,offset),deadline));
    rows.push(...page);
    if (page.length < size) break;
  }
  return rows;
}

function fetchBoard(board: Board) {
  const key = boardKey(board);
  const cached = cache.get(key);
  if (cached && cached.freshUntil > Date.now()) return Promise.resolve(cached.jobs);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const connector = connectors[board.source];
  const task = (async () => {
    const rows = await listRows(board,connector);
    const jobs = rows.flatMap(row => {
      const job = normalizeJob(board,row);
      if (!job) return [];
      if (board.source === "ashby" && typeof row === "object" && row !== null && "isListed" in row && row.isListed === false) return [];
      return [job];
    });
    if (rows.length && !jobs.length && rows.some(row=>typeof row === "object" && row !== null &&
        !("isListed" in row && row.isListed === false) && !("internal_job_id" in row && row.internal_job_id === null))) {
      throw new Error("Provider response shape");
    }
    if (cache.size >= 32 && !cache.has(key)) cache.delete(cache.keys().next().value!);
    const now = Date.now();
    cache.set(key,{jobs,freshUntil:now + cacheDuration,staleUntil:now + staleDuration});
    return jobs;
  })().finally(()=>pending.delete(key));
  pending.set(key,task);
  return task;
}

export type BoardStatus = { source: Preferences["sources"][number]; company: string; status:"ok"|"stale"|"error"; count:number };
export interface SearchResponse { jobs: Job[]; boards: BoardStatus[]; partial: boolean }
export interface SearchPage extends SearchResponse { next: string | null; snapshot: string }

const linkedInSearchCache = new Map<string,{jobs:Job[];freshUntil:number;staleUntil:number}>();
const linkedInSearchPending = new Map<string,Promise<Job[]>>();
const linkedInDetails = new Map<string,{job:Job;freshUntil:number}>();

function remember<K,V>(entries: Map<K,V>, key: K, value: V, capacity: number) {
  entries.delete(key);
  entries.set(key,value);
  if (entries.size>capacity) entries.delete(entries.keys().next().value!);
}

async function fetchLinkedIn(search: LinkedInSearch) {
  const url = linkedInListUrl(search);
  const cached = linkedInSearchCache.get(url);
  const base = {source:"linkedin",company:"LinkedIn"} as const;
  try {
    let jobs = cached?.jobs;
    if (!cached || cached.freshUntil<=Date.now()) {
      let task = linkedInSearchPending.get(url);
      if (!task) {
        task = fetchPublic(url,AbortSignal.timeout(timeout))
          .then(({body})=>{
            const jobs = parseLinkedInList(body);
            const now = Date.now();
            remember(linkedInSearchCache,url,{jobs,freshUntil:now+cacheDuration,staleUntil:now+staleDuration},48);
            return jobs;
          }).finally(()=>linkedInSearchPending.delete(url));
        linkedInSearchPending.set(url,task);
      }
      jobs = await task;
    }
    const results = (jobs ?? []).map(job=>{
      const detail = linkedInDetails.get(job.externalId);
      return detail && detail.freshUntil>Date.now() ? {...detail.job,publishedAt:job.publishedAt ?? detail.job.publishedAt} : job;
    });
    return {jobs:results,status:{...base,status:"ok",count:results.length} satisfies BoardStatus};
  } catch {
    const jobs = cached && cached.staleUntil>Date.now() ? cached.jobs : undefined;
    return {jobs:jobs ?? [],status:{...base,status:jobs ? "stale" : "error",count:jobs?.length ?? 0} satisfies BoardStatus};
  }
}

async function getLinkedInJob(id: string) {
  const cached = linkedInDetails.get(id);
  if (cached && cached.freshUntil>Date.now()) return cached.job;
  const summary = [...linkedInSearchCache.values()].reverse()
    .filter(entry=>entry.staleUntil>Date.now()).flatMap(entry=>entry.jobs).find(job=>job.externalId===id);
  const url = linkedInPostingUrl(id,summary?.sourceUrl ?? undefined);
  if (!url) return null;
  try {
    const response = await fetchPublic(url,AbortSignal.timeout(12_000),id);
    const job = parseLinkedInDetail(response.body,id,response.url,summary);
    remember(linkedInDetails,id,{job,freshUntil:Date.now()+cacheDuration},120);
    return job;
  } catch (error) {
    if (error instanceof HttpError && [404,410].includes(error.status)) return null;
    if (summary) return summary;
    throw new HttpError(503,"PROVIDER_UNAVAILABLE","O LinkedIn não retornou os detalhes da vaga. Tente novamente mais tarde.");
  }
}

const attempts = new Map<string,number>();
export async function fetchCatalog(sources: Preferences["sources"], search = linkedInSearchSchema.parse({})): Promise<SearchResponse> {
  const boards = catalog().filter(board => !sources.length || sources.includes(board.source));
  const linkedInResult = !sources.length || sources.includes("linkedin") ? fetchLinkedIn(search) : null;
  const boardResults = boards.map(async board => {
    const key = boardKey(board);
    const base = {source:board.source,company:board.company};
    try {
      if ((attempts.get(key) ?? 0) > Date.now()) throw new Error("Board cooldown");
      const jobs = await fetchBoard(board);
      return {jobs,status:{...base,status:"ok",count:jobs.length} satisfies BoardStatus};
    } catch {
      if ((attempts.get(key) ?? 0) <= Date.now()) attempts.set(key,Date.now()+15_000);
      const stored = cache.get(key);
      const jobs = stored && stored.staleUntil > Date.now() ? stored.jobs : undefined;
      return {jobs:jobs ?? [],status:{...base,status:jobs ? "stale" : "error",count:jobs?.length ?? 0} satisfies BoardStatus};
    }
  });
  const [results,linkedIn] = await Promise.all([
    Promise.all(boardResults),
    linkedInResult,
  ]);
  const statuses: BoardStatus[] = results.map(result=>result.status);
  if (linkedIn) statuses.push(linkedIn.status);
  const boardJobs = results.flatMap(result=>result.jobs);
  const linkedInJobs = linkedIn?.jobs ?? [];
  // Interleave the list before the UI applies the selected sort.
  const jobs = deduplicate([
    ...linkedInJobs.flatMap((job,index)=>[...boardJobs.slice(index,index+1),job]),
    ...boardJobs.slice(linkedInJobs.length),
  ]);
  return {jobs,boards:statuses,partial:statuses.some(board=>board.status !== "ok")};
}

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ashbyUuid = new RegExp(`^(?:job/)?(${uuid})(?:/application)?$`,"i");

export function identifyPosting(input: string) {
  const url = safeExternalUrl(input);
  if (!url) return null;
  const host = url.hostname;
  const pathname = url.pathname.replace(/\/+$/,"");
  let match: RegExpMatchArray | null;
  let source: Board["source"];
  let id: string;
  if (["boards.greenhouse.io","job-boards.greenhouse.io"].includes(host)) {
    match = pathname.match(/^\/([a-z\d_-]+)\/jobs\/(\d{1,18})$/i);
    if (!match) return null;
    source = "greenhouse";
    id = match[2];
  } else if (["jobs.lever.co","jobs.eu.lever.co"].includes(host)) {
    match = pathname.match(new RegExp(`^/([a-z0-9_-]+)/(${uuid})(?:/apply)?$`,"i"));
    if (!match) return null;
    source = "lever";
    id = match[2].toLowerCase();
  } else if (host === "jobs.ashbyhq.com") {
    match = pathname.match(/^\/([a-z\d_-]+)\/(.+)$/i);
    const extracted = match?.[2].match(ashbyUuid);
    if (!match || !extracted) return null;
    source = "ashby";
    id = extracted[1].toLowerCase();
  } else {
    return null;
  }
  const slug = match[1];
  const region = host === "jobs.eu.lever.co" ? "eu" : "global";
  const listed = catalog().find(board => board.source === source && board.region === region && board.slug.toLowerCase() === slug.toLowerCase());
  const board = boardSchema.safeParse(listed ?? {source,slug,region,company:"Empresa não informada"});
  return board.success ? {board:board.data,id,known:Boolean(listed)} : null;
}

async function officialDetail(board: Board, id: string, known = true) {
  const connector = connectors[board.source];
  if (connector.detailUrl) {
    const row = await fetchProvider(connector.detailUrl(board,id));
    let resolvedBoard = board;
    if (!known && typeof row === "object" && row !== null && "company_name" in row && typeof row.company_name === "string") {
      resolvedBoard = {...board,company:row.company_name.trim().slice(0,120) || board.company};
    }
    return normalizeJob(resolvedBoard,row);
  }
  const rows = connector.parseList(await fetchProvider(connector.listUrl(board)));
  for (const row of rows) {
    if (typeof row !== "object" || row === null || !("jobUrl" in row) || typeof row.jobUrl !== "string") continue;
    const url = safeExternalUrl(row.jobUrl);
    if (url?.pathname.replace(/\/+$/,"").split("/").at(-1)?.toLowerCase() === id) return normalizeJob(board,row);
  }
  return null;
}

export async function jobFromUrl(input: string) {
  const match = identifyPosting(input);
  if (!match) return null;
  return officialDetail(match.board,match.id,match.known);
}

const detailId = z.string().max(300).regex(/^(?:greenhouse|lever|ashby):(?:global|eu):[a-z0-9_-]+:[a-z0-9-]+$/);

export async function getCatalogJob(value: string) {
  const linkedInId = value.match(/^linkedin:(\d{1,18})$/)?.[1];
  if (linkedInId) return getLinkedInJob(linkedInId);
  if (!detailId.safeParse(value).success) return null;
  const [source,region,slug,id] = value.split(":");
  const board = catalog().find(item=>item.source === source && item.region === region && item.slug.toLowerCase() === slug);
  if (!board || !(source === "greenhouse" ? /^\d{1,18}$/.test(id) : new RegExp(`^${uuid}$`,"i").test(id))) return null;
  const cached = cache.get(boardKey(board));
  const job = cached && cached.freshUntil > Date.now() ? cached.jobs.find(entry=>entry.id === value) : undefined;
  if (job && (source !== "greenhouse" || job.salaryCurrency)) return job;
  return officialDetail(board,id).catch(error => {
    if (job && !(error instanceof HttpError && error.status === 404)) return job;
    throw error;
  });
}
