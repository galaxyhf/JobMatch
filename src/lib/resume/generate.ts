import { HttpError } from "../http";
import type { ResumeGenerationRequest } from "../schema";

export interface ResumeGenerator {
  generate(request: ResumeGenerationRequest): Promise<{ data: Uint8Array; contentType: string; filename: string }>;
}

export function generateResume(input: ResumeGenerationRequest, provider?: ResumeGenerator) {
  if (!provider) throw new HttpError(501, "AI_NOT_CONFIGURED", "Personalização com IA disponível em breve.");
  return provider.generate(input);
}
