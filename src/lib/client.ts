export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(()=>null);
  if (!response.ok || data === null) {
    const fallback = response.status === 413 ? "O arquivo ultrapassa o limite de 4 MB." : "A operação falhou. Tente novamente.";
    throw new ApiError(data?.code ?? "UNEXPECTED", data?.message ?? fallback);
  }
  return data as T;
}
