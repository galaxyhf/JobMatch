import { handleError, HttpError, json, rateLimit } from "@/lib/http";
import { getCatalogJob } from "@/lib/jobs/providers";

export const maxDuration = 15;

export async function GET(request: Request, context: RouteContext<"/api/jobs/[id]">) {
  try {
    rateLimit(request,"search");
    const job = await getCatalogJob((await context.params).id);
    if (!job) throw new HttpError(404,"JOB_NOT_FOUND","A vaga não foi encontrada.");
    return json({job});
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return handleError(new HttpError(404,"JOB_NOT_FOUND","A vaga não está mais disponível no quadro original."));
    }
    return handleError(error);
  }
}
