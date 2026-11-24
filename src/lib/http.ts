export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export function json(data: unknown, status = 200, retryAfter?: number) {
  const headers = new Headers({"Cache-Control": "no-store"});
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return Response.json(data, {status, headers});
}

export function handleError(error: unknown) {
  return error instanceof HttpError
    ? json({code: error.code, message: error.message}, error.status, error.retryAfter)
    : json({code: "UNEXPECTED", message: "Não foi possível concluir a operação. Tente novamente."}, 500);
}

export async function boundedBytes(
  input: Request | Response, limit: number,
  onLimit = () => new HttpError(413, "TOO_LARGE", "O conteúdo ultrapassa o tamanho permitido."),
) {
  if (Number(input.headers.get("content-length")) > limit) {
    await input.body?.cancel().catch(() => undefined);
    throw onLimit();
  }
  const reader = input.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => undefined);
        throw onLimit();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJson(request: Request, limit = 100_000): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new HttpError(415, "CONTENT_TYPE", "Envie o conteúdo no formato JSON.");
  }
  const bytes = await boundedBytes(request, limit);
  try {
    return JSON.parse(new TextDecoder("utf-8", {fatal:true}).decode(bytes));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "O conteúdo enviado está inválido.");
  }
}

const buckets = new Map<string, {count: number; expire: number}>();
const quotas = { parse: [8, 45], search: [60, 900], analyze: [20, 250], generate: [10, 100] } as const;

export function rateLimit(request: Request, scope: keyof typeof quotas) {
  const now = Date.now();
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",").at(-1)?.trim().slice(0, 64) || "local";
  for (const [key, bucket] of buckets) {
    if (bucket.expire <= now) buckets.delete(key);
  }
  for (const [key, limit] of [[scope + ":*",quotas[scope][1]], [scope + ":" + ip,quotas[scope][0]]] as const) {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {count:0, expire: now + 60_000};
      buckets.set(key,bucket);
    }
    if (bucket.count >= limit) {
      throw new HttpError(429, "RATE_LIMIT", "Muitas solicitações. Aguarde um momento e tente novamente.", Math.ceil((bucket.expire - now) / 1000));
    }
    bucket.count++;
  }
}
