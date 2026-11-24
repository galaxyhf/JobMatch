import { createHash } from "node:crypto";
import { HttpError } from "../http";
import type { SearchPage, SearchResponse } from "./providers";

const pageBytes = 2_500_000;

export function catalogPage(data: SearchResponse, cursor?: string, snapshot?: string, byteLimit = pageBytes): SearchPage {
  const {jobs,boards,partial} = data;
  const current = createHash("sha256").update(JSON.stringify(jobs.map(job=>job.id))).digest("base64url");
  const start = cursor ? jobs.findIndex(job=>job.id===cursor) + 1 : 0;
  if (cursor && (snapshot!==current || !start)) {
    throw new HttpError(409,"CATALOG_CHANGED","O catálogo mudou durante a busca. Tente novamente.");
  }
  let bytes = Buffer.byteLength(JSON.stringify({jobs:[],boards,partial,next:cursor ?? "",snapshot:current})) + 512;
  let end = start;
  for (; end<jobs.length; end++) {
    const next = Buffer.byteLength(JSON.stringify(jobs[end])) + 1;
    if (bytes + next > byteLimit && end>start) break;
    bytes += next;
  }
  return {jobs:jobs.slice(start,end),boards,partial,next:end<jobs.length ? jobs[end-1].id : null,snapshot:current};
}
