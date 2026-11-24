import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fold(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function safeExternalUrl(value: string): URL | null {
  try {
    if (!/^https:\/\//i.test(value) || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/.test(host) ||
        /\.(?:local|localhost|internal|test|invalid|example|lan|arpa|onion|home|corp)$/.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

export function formatSalary(min: number | null, max: number | null, currency: string | null, interval?: string | null) {
  if ((min === null && max === null) || !currency) return null;
  const format = new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 });
  const suffix = ({year:"/ano",month:"/mês",hour:"/hora",week:"/semana",day:"/dia"} as Record<string,string>)[interval ?? ""] ?? "";
  if (min !== null && max !== null && min !== max) return `${format.format(min)} a ${format.format(max)}${suffix}`;
  if (min === max) return `${format.format(min!)}${suffix}`;
  return `${min !== null ? "A partir de " : "Até "}${format.format(min ?? max!)}${suffix}`;
}

export function decodeJobId(value: string) {
  try {return decodeURIComponent(value);}
  catch {return "";}
}
