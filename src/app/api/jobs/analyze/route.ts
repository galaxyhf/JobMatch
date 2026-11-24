import { randomUUID } from "node:crypto";
import { handleError, HttpError, json, rateLimit, readJson } from "@/lib/http";
import { makeManualJob } from "@/lib/jobs/normalize";
import { identifyPosting, jobFromUrl } from "@/lib/jobs/providers";
import { analysisSchema } from "@/lib/schema";

export const maxDuration = 15;

export async function POST(request: Request) {
  try {
    rateLimit(request,"analyze");
    const input = analysisSchema.safeParse(await readJson(request, 250_000));
    if (!input.success) throw new HttpError(400,"INVALID_INPUT",input.error.issues[0]?.message ?? "Revise os dados da vaga.");
    const {url,description,title,company} = input.data;
    if (description) return json({job:makeManualJob(randomUUID(),description,url,title,company)});
    if (url && identifyPosting(url)) {
      try {
        const job = await jobFromUrl(url);
        if (job?.description) return json({job});
      } catch {
        throw new HttpError(422,"MANUAL_REQUIRED","A fonte oficial não retornou a descrição. Cole o texto da vaga para analisar.");
      }
    }
    throw new HttpError(422,"MANUAL_REQUIRED","Cole a descrição da vaga para analisar esse link.");
  } catch (error) {
    return handleError(error);
  }
}
