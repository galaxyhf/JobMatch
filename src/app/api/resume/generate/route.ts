import { handleError, HttpError, rateLimit, readJson } from "@/lib/http";
import { generationSchema } from "@/lib/schema";
import { generateResume } from "@/lib/resume/generate";

export async function POST(request: Request) {
  try {
    rateLimit(request,"generate");
    const input = generationSchema.safeParse(await readJson(request, 520_000));
    if (!input.success) throw new HttpError(400, "INVALID_INPUT", "Revise os dados do currículo e da vaga.");
    const document = await generateResume(input.data);
    return new Response(Uint8Array.from(document.data), {
      headers: {"Cache-Control":"no-store","Content-Type":document.contentType,
        "Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`},
    });
  } catch (error) {
    return handleError(error);
  }
}
