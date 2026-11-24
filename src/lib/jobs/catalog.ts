import { z } from "zod";
import { providers } from "../schema";

export const boardSchema = z.object({
  source: z.enum(providers),
  slug: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/),
  company: z.string().trim().min(1).max(120),
  region: z.enum(["global","eu"]).default("global"),
});
export type Board = z.infer<typeof boardSchema>;
export type Provider = Board["source"];

const defaultBoards: Board[] = [
  {source:"greenhouse",slug:"quintoandar",company:"Grupo QuintoAndar",region:"global"},
  {source:"greenhouse",slug:"ebanx",company:"EBANX",region:"global"},
  {source:"greenhouse",slug:"vtex",company:"VTEX",region:"global"},
  {source:"lever",slug:"ciandt",company:"CI&T",region:"global"},
  {source:"lever",slug:"binance",company:"Binance",region:"global"},
  {source:"ashby",slug:"linear",company:"Linear",region:"global"},
  {source:"ashby",slug:"supabase",company:"Supabase",region:"global"},
  {source:"ashby",slug:"webflow",company:"Webflow",region:"global"},
];

export function catalog(): Board[] {
  if (!process.env.JOB_BOARDS) return defaultBoards;
  try {
    const boards = z.array(boardSchema).min(1).max(16).parse(JSON.parse(process.env.JOB_BOARDS));
    const seen = new Set<string>();
    return boards.filter(board => {
      const key = boardKey(board);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return defaultBoards;
  }
}

export function boardKey(board: Board) {
  return `${board.source}:${board.region}:${board.slug.toLowerCase()}`;
}
