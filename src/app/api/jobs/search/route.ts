import { z } from "zod";
import { handleError, HttpError, json, rateLimit } from "@/lib/http";
import { catalogPage } from "@/lib/jobs/pagination";
import { fetchCatalog } from "@/lib/jobs/providers";
import { preferencesSchema } from "@/lib/schema";

export const maxDuration = 35;
const parameters = preferencesSchema.pick({sources:true}).extend({
  after:z.string().min(1).max(300).optional(),
  snapshot:z.string().regex(/^[\w-]{43}$/).optional(),
}).refine(({after,snapshot})=>Boolean(after)===Boolean(snapshot));

export async function GET(request: Request) {
  try {
    rateLimit(request,"search");
    const query = new URL(request.url).searchParams;
    const parsed = parameters.safeParse({sources:query.getAll("source"),after:query.get("after") ?? undefined,snapshot:query.get("snapshot") ?? undefined});
    if (!parsed.success) throw new HttpError(400,"INVALID_FILTERS","Selecione fontes válidas e revise os parâmetros da busca.");
    const {sources,after,snapshot} = parsed.data;
    return json(catalogPage(await fetchCatalog(sources),after,snapshot));
  } catch (error) {
    return handleError(error);
  }
}
