import { z } from "zod";
import { jobSchema, salaryIntervals, type Job } from "../schema";
import { countriesIn } from "../terms";
import { compact, fold, safeExternalUrl, unique } from "../utils";
import { contentFields, employmentIn, plainHtml } from "./content";
import type { Board } from "./catalog";

const string = z.string();
const optional = string.nullish();
const plainList = z.array(z.string()).nullish();
const urls = {applyUrl:optional};
const amount = z.number().nonnegative().nullish();
const salaryRange = z.object({min:amount,max:amount,currency:optional,interval:optional});
const address = z.object({addressCountry:optional}).nullish();
const component = z.object({compensationType:optional,currencyCode:optional,interval:optional,minValue:amount,maxValue:amount});
const greenhouseSchema = z.object({
  id:z.union([z.number().int().positive(),z.string()]), internal_job_id:z.number().nullish(), title:string, absolute_url:string,
  content:optional, location:z.object({name:optional}).nullish(),
  metadata:z.array(z.object({name:string,value:z.unknown()})).nullish(),
  pay_input_ranges:z.array(z.object({min_cents:amount,max_cents:amount,currency_type:optional})).nullish(),
  first_published:optional,
});
const leverSchema = z.object({
  id:string,text:string,hostedUrl:string,...urls,workplaceType:optional,country:optional,
  description:optional,descriptionPlain:optional,additional:optional,additionalPlain:optional,
  lists:z.array(z.object({text:optional,content:optional})).nullish(),
  categories:z.object({location:optional,allLocations:plainList,commitment:optional}).nullish(),
  salaryRange:salaryRange.nullish(),
});
const ashbySchema = z.object({
  id:optional,title:string,jobUrl:string,...urls,department:optional,isListed:z.boolean().optional(),
  location:optional,secondaryLocations:z.array(z.object({location:optional,address})).nullish(),
  address:z.object({postalAddress:address}).nullish(),workplaceType:optional,isRemote:z.boolean().optional(),
  employmentType:optional,descriptionPlain:optional,descriptionHtml:optional,publishedAt:optional,
  compensation:z.object({
    summaryComponents:z.array(component).nullish(),
    compensationTiers:z.array(z.object({components:z.array(component).nullish()})).nullish(),
  }).nullish(),
});

const missingSalary = {salaryMin:null,salaryMax:null,salaryCurrency:null,salaryInterval:null};
function salary(min: number | null | undefined, max: number | null | undefined, currency: string | null | undefined, interval?: string | null) {
  const code = currency?.trim().toUpperCase();
  if (!code || !/^[A-Z]{3}$/.test(code) || (min == null && max == null) || (min != null && max != null && min > max)) return missingSalary;
  const unit = interval?.toLowerCase().replace(/^1\s+/,"").replace(/^per[\s_-]+/,"").replace(/ly$/,"");
  const salaryInterval = salaryIntervals.find(value => value === unit || (value === "day" && unit === "dai")) ?? null;
  return {salaryMin:min ?? null,salaryMax:max ?? null,salaryCurrency:code,salaryInterval};
}

function ashbySalary(job: z.infer<typeof ashbySchema>) {
  const comp = job.compensation;
  const summary = comp?.summaryComponents?.filter(item=>item.compensationType === "Salary") ?? [];
  const tiers = comp?.compensationTiers?.flatMap(tier=>tier.components ?? []).filter(item=>item.compensationType === "Salary") ?? [];
  const ranges = summary.length ? summary : tiers;
  const sample = ranges[0];
  if (!sample || ranges.some(r=>r.currencyCode !== sample.currencyCode || r.interval !== sample.interval)) return missingSalary;
  const min = ranges.flatMap(r=>r.minValue == null ? [] : [r.minValue]);
  const max = ranges.flatMap(r=>r.maxValue == null ? [] : [r.maxValue]);
  return salary(min.length ? Math.min(...min) : null,max.length ? Math.max(...max) : null,sample.currencyCode,sample.interval);
}

function greenhouseSalary(job: z.infer<typeof greenhouseSchema>) {
  const ranges = job.pay_input_ranges ?? [];
  const currency = ranges[0]?.currency_type;
  if (!currency || ranges.some(range=>range.currency_type !== currency)) return missingSalary;
  const min = ranges.flatMap(range=>range.min_cents == null ? [] : [range.min_cents / 100]);
  const max = ranges.flatMap(range=>range.max_cents == null ? [] : [range.max_cents / 100]);
  return salary(min.length ? Math.min(...min) : null,max.length ? Math.max(...max) : null,currency);
}

function workMode(value: string | null | undefined): Job["workMode"] | undefined {
  const key = fold(value ?? "").replace(/[^a-z]/g,"");
  if (key === "remote" || key === "remoto") return "remote";
  if (key === "hybrid" || key === "hibrido") return "hybrid";
  if (["onsite","presencial","inoffice"].includes(key)) return "onsite";
}

function date(value: string | undefined | null) {
  if (!value || !/^\d{4}-\d\d-\d\dT/.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

interface Posting {
  externalId: string;
  title: string;
  description: string;
  location?: string | null;
  countries?: string[];
  sourceUrl: string;
  applicationUrl?: string | null;
  publishedAt?: string | null;
  employment?: string | null;
  mode?: Job["workMode"];
  salary?: typeof missingSalary | ReturnType<typeof salary>;
}

function greenhouse(input: unknown): Posting | null {
  const parsed = greenhouseSchema.safeParse(input);
  if (!parsed.success || parsed.data.internal_job_id === null) return null;
  const row = parsed.data;
  const metadata = (pattern:RegExp) => row.metadata?.find(field=>pattern.test(fold(field.name)))?.value;
  const modeValue = metadata(/^(workplace type|work mode|work model|modalidade|modelo de trabalho)$/);
  const contract = metadata(/^(employment type|contract type|tipo de contrato|contratacao)$/);
  return {
    externalId:String(row.id),title:row.title,description:plainHtml(row.content ?? "",true),location:row.location?.name,
    sourceUrl:row.absolute_url,publishedAt:date(row.first_published),salary:greenhouseSalary(row),
    employment:typeof contract === "string" ? contract : null,
    mode:workMode(typeof modeValue === "string" ? modeValue : null),
  };
}

function lever(input: unknown): Posting | null {
  const parsed = leverSchema.safeParse(input);
  if (!parsed.success) return null;
  const row = parsed.data;
  const description = [
    row.description ? plainHtml(row.description) : row.descriptionPlain,
    ...((row.lists ?? []).map(list => [list.text,plainHtml(list.content ?? "")].filter(Boolean).join("\n"))),
    row.additional ? plainHtml(row.additional) : row.additionalPlain,
  ].filter(Boolean).join("\n\n");
  return {
    externalId:row.id,title:row.text,description,sourceUrl:row.hostedUrl,applicationUrl:row.applyUrl,
    location:unique([row.categories?.location,...(row.categories?.allLocations ?? [])].filter((value):value is string=>Boolean(value))).join(" · "),
    countries:row.country ? countriesIn(row.country) : [],
    employment:/^(?:home[ -]?office|remote|remoto|hybrid|híbrido|onsite|presencial)$/i.test(row.categories?.commitment ?? "")
      ? null : row.categories?.commitment,
    mode:workMode(row.workplaceType)
      ?? workMode(row.categories?.commitment)
      ?? (/^home[ -]?office$/i.test(row.categories?.commitment ?? "") ? "remote" : undefined),
    salary:row.salaryRange ? salary(row.salaryRange.min,row.salaryRange.max,row.salaryRange.currency,row.salaryRange.interval) : missingSalary,
  };
}

function ashby(input: unknown): Posting | null {
  const parsed = ashbySchema.safeParse(input);
  if (!parsed.success) return null;
  const row = parsed.data;
  const source = safeExternalUrl(row.jobUrl);
  const externalId = row.id ?? source?.pathname.split("/").filter(Boolean).at(-1);
  if (!externalId) return null;
  return {
    externalId,title:row.title,description:row.descriptionHtml ? plainHtml(row.descriptionHtml) : (row.descriptionPlain ?? ""),
    location:unique([row.location,...(row.secondaryLocations ?? []).map(item=>item.location)].filter((value):value is string=>Boolean(value))).join(" · "),
    countries:unique([row.address?.postalAddress?.addressCountry,...(row.secondaryLocations ?? []).map(item=>item.address?.addressCountry)]
      .flatMap(value=>value ? countriesIn(value) : [])),
    employment:row.employmentType,mode:workMode(row.workplaceType) ?? (row.isRemote === true ? "remote" : undefined),
    sourceUrl:row.jobUrl,applicationUrl:row.applyUrl,publishedAt:date(row.publishedAt),salary:ashbySalary(row),
  };
}

const normalizePosting = {greenhouse,lever,ashby};

export function normalizeJob(board: Board, input: unknown): Job | null {
  const row = normalizePosting[board.source](input);
  if (!row) return null;
  return jobFromPosting(board.source,`${board.source}:${board.region}:${board.slug.toLowerCase()}:${row.externalId}`,board.company,row);
}

export function jobFromPosting(provider: Exclude<Job["source"],"manual">, id: string, company: string, row: Posting): Job | null {
  const source = safeExternalUrl(row.sourceUrl);
  const application = row.applicationUrl ? safeExternalUrl(row.applicationUrl) : source;
  if (!source || !application) return null;
  const title = compact(row.title).slice(0,300);
  const location = compact(row.location ?? "").slice(0,300);
  const countries = row.countries?.length ? row.countries : countriesIn(location);
  const country = countries.length === 1 ? countries[0] : null;
  const description = row.description.slice(0,60_000);
  const content = contentFields(title,description,location,country,row.mode,countries);
  const job = jobSchema.safeParse({
    id,source:provider,externalId:row.externalId,title,company:compact(company).slice(0,300),location:location || null,country,
    description,publishedAt:row.publishedAt ?? null,applicationUrl:application.href,sourceUrl:source.href,
    employmentType:employmentIn(row.employment ?? "",description)?.slice(0,300) ?? null,
    ...(row.salary ?? missingSalary),...content,
  });
  return job.success ? job.data : null;
}

export function makeManualJob(id: string, description: string, url?: string, title?: string, company?: string): Job {
  return {
    id,source:"manual",externalId:id,title:title || "Vaga informada",company:company || "Empresa não informada",
    location:null,country:null,description,employmentType:employmentIn("",description),publishedAt:null,
    applicationUrl:url ?? null,sourceUrl:url ?? null,...missingSalary,...contentFields(title ?? "",description,"",null),
  };
}

export function canonicalLink(value: string | null) {
  if (!value) return "";
  const url = safeExternalUrl(value);
  if (!url) return "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_\w+|gh_src|lever-source|ashby_source|source|ref|referrer)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.hash = "";
  const host = url.hostname === "job-boards.greenhouse.io" ? "boards.greenhouse.io" : url.hostname.replace(/^www\./,"");
  return host + url.pathname.replace(/\/apply\/?$/i,"").replace(/\/+$/,"") + url.search;
}

export function deduplicate(jobs: Job[]) {
  const ids = new Set<string>();
  const links = new Set<string>();
  const contentFingerprints = new Set<string>();
  return jobs.filter(job => {
    const urls = [job.sourceUrl,job.applicationUrl].map(canonicalLink).filter(Boolean);
    const description = fold(compact(job.description));
    const content = description.length >= 140
      ? [job.title,job.company,job.location ?? ""].map(value=>fold(compact(value))).join("|") + "|" + description
      : "";
    if (ids.has(job.id) || urls.some(url=>links.has(url)) || (content && contentFingerprints.has(content))) return false;
    ids.add(job.id);
    for (const url of urls) links.add(url);
    if (content) contentFingerprints.add(content);
    return true;
  });
}
