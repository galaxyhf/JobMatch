import { z } from "zod";
import { handleError, HttpError, json, rateLimit } from "@/lib/http";
import { linkedInSearchSchema } from "@/lib/jobs/linkedin";
import { catalogPage } from "@/lib/jobs/pagination";
import { fetchCatalog } from "@/lib/jobs/providers";
import { preferencesSchema } from "@/lib/schema";

export const maxDuration = 35;
const parameters = linkedInSearchSchema.extend({
  sources:preferencesSchema.shape.sources,
  after:z.string().min(1).max(300).optional(),
  snapshot:z.string().regex(/^[\w-]{43}$/).optional(),
}).refine(({after,snapshot})=>Boolean(after)===Boolean(snapshot));

export async function GET(request: Request) {
  try {
    rateLimit(request,"search");
    const query = new URL(request.url).searchParams;
    const parsed = parameters.safeParse({
      keywords:query.get("keywords") ?? undefined, role:query.get("role") ?? undefined,
      city:query.get("city") ?? undefined, company:query.get("company") ?? undefined,
      publicationPeriod:query.get("publicationPeriod") ?? undefined,
      countries:query.getAll("country"), technologies:query.getAll("technology"), workModes:query.getAll("workMode"),
      sources:query.getAll("source"), after:query.get("after") ?? undefined, snapshot:query.get("snapshot") ?? undefined,
    });
    if (!parsed.success) throw new HttpError(400,"INVALID_FILTERS","Selecione fontes válidas e revise os parâmetros da busca.");
    const {sources,after,snapshot,...search} = parsed.data;
    return json(catalogPage(await fetchCatalog(sources,search),after,snapshot));
  } catch (error) {
    return handleError(error);
  }
}
