import { boundedBytes, handleError, HttpError, json, rateLimit } from "@/lib/http";
import { extractResume, maxUploadBytes } from "@/lib/resume/extract";
import { parseResume } from "@/lib/resume/parser";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(request: Request) {
  try {
    rateLimit(request, "parse");
    const mime = request.headers.get("content-type") ?? "";
    if (!/^multipart\/form-data\s*;/i.test(mime)) throw new HttpError(415, "CONTENT_TYPE", "Envie um currículo em PDF ou DOCX.");
    const body = await boundedBytes(request, maxUploadBytes + 32_768,
      () => new HttpError(413, "TOO_LARGE", "Envie um arquivo de até 4 MB."));
    const form = await new Response(body, {headers:{"Content-Type":mime}}).formData().catch(() => null);
    const uploads = form?.getAll("file") ?? [];
    if (uploads.length !== 1 || !(uploads[0] instanceof File)) throw new HttpError(400, "FILE_REQUIRED", "Selecione um único currículo.");
    return json({resume:parseResume(await extractResume(uploads[0]))});
  } catch (error) {
    return handleError(error);
  }
}
