import { z } from "zod";
import { safeExternalUrl } from "./utils";

const text = z.string().trim().max(300);
const line = z.string().trim().min(1).max(500);
const list = z.array(line).max(100);

export const resumeSchema = z.object({
  name: text, email: z.union([z.email().max(254), z.literal("")]), phone: text,
  location: text, summary: z.string().trim().max(6000), experience: list,
  previousRoles: list, education: list, technologies: list, skills: list,
  languages: list, certifications: list, projects: list, desiredRoles: list,
});
export type ParsedResume = z.infer<typeof resumeSchema>;
export const emptyResume: ParsedResume = {
  name: "", email: "", phone: "", location: "", summary: "", experience: [],
  previousRoles: [], education: [], technologies: [], skills: [], languages: [],
  certifications: [], projects: [], desiredRoles: [],
};

export const providers = ["greenhouse", "lever", "ashby"] as const;
export const sourceNames = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", manual: "Análise manual" };
export const modes = ["remote", "hybrid", "onsite", "unknown"] as const;
export const modeNames = {remote:"Remoto", hybrid:"Híbrido", onsite:"Presencial", unknown:"Modalidade não informada"};
export const seniorities = ["intern", "junior", "mid", "senior", "lead"] as const;
export const seniorityNames = { intern:"Estágio", junior:"Júnior", mid:"Pleno", senior:"Sênior", lead:"Liderança" };
export const languageNames = {pt:"Português", en:"Inglês", es:"Espanhol", fr:"Francês", de:"Alemão", it:"Italiano", ja:"Japonês", zh:"Mandarim"};
export const employmentNames = {fulltime:"Tempo integral", parttime:"Tempo parcial", intern:"Estágio", contract:"Contrato", temporary:"Temporário", clt:"CLT", pj:"PJ"};
export const salaryIntervals = ["year", "month", "week", "day", "hour"] as const;
export const publicationPeriods = ["day", "week", "month"] as const;
export const publicationPeriodSeconds = {day:86_400, week:604_800, month:2_592_000};
export const publicationPeriodNames = {day:"Últimas 24 horas", week:"Últimos 7 dias", month:"Últimos 30 dias"};
const countries = z.string().regex(/^[A-Z]{2}$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
const externalUrl = z.string().trim().max(2048).refine(safeExternalUrl, "Informe um link HTTPS válido.");

export const preferencesSchema = z.object({
  role: text.default(""), keywords: text.default(""), technologies: z.array(text).max(30).default([]),
  countries: z.array(countries).max(40).default([]), city: text.default(""),
  workModes: z.array(z.enum(modes)).max(4).default([]),
  seniorities: z.array(z.enum(seniorities)).max(5).default([]),
  employmentType: text.default(""), company: text.default(""),
  salaryMin: z.number().nonnegative().max(1e9).nullable().default(null),
  currency: z.union([currency,z.literal("")]).default(""),
  salaryInterval: z.enum(salaryIntervals).or(z.literal("")).default(""),
  publicationPeriod: z.enum(publicationPeriods).or(z.literal("")).default(""),
  language: z.enum(["pt","en","es","fr","de","it","ja","zh"]).or(z.literal("")).default(""),
  sources: z.array(z.enum(providers)).max(3).default([]),
  minMatch: z.number().int().min(0).max(100).default(0),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const emptyPreferences = preferencesSchema.parse({});

export const jobSchema = z.object({
  id: z.string().min(1).max(300),
  source: z.enum([...providers, "manual"]),
  externalId: z.string().min(1).max(220),
  title: z.string().min(1).max(300),
  company: z.string().min(1).max(300),
  location: text.nullable(),
  country: countries.nullable(),
  workMode: z.enum(modes),
  employmentType: text.nullable(),
  seniority: z.enum(seniorities).nullable(),
  salaryMin: z.number().nonnegative().nullable(),
  salaryMax: z.number().nonnegative().nullable(),
  salaryCurrency: currency.nullable(),
  salaryInterval: z.enum(salaryIntervals).nullable(),
  description: z.string().max(60_000),
  requirements: list,
  required: list,
  preferred: list,
  responsibilities: list,
  technologies: list,
  benefits: list,
  languages: list,
  publishedAt: z.iso.datetime({offset:true}).nullable(),
  applicationUrl: externalUrl.nullable(),
  sourceUrl: externalUrl.nullable(),
  geography: z.object({
    status: z.enum(["unspecified","restricted","worldwide"]),
    evidence: list,
    eligibleCountries: z.array(countries).max(50),
    excludesBrazil: z.boolean(),
    includesBrazil: z.boolean(),
  }),
});
export type Job = z.infer<typeof jobSchema>;

export const analysisSchema = z.object({
  url: externalUrl.optional(),
  title: text.optional(),
  company: text.optional(),
  description: z.string().trim().min(30, "Cole uma descrição com pelo menos 30 caracteres.").max(55_000).optional(),
}).refine(({ url, description }) => Boolean(url || description), "Informe um link ou cole a descrição da vaga.");

export const generationSchema = z.object({
  resume: resumeSchema, job: jobSchema, language: z.enum(["pt-BR", "en", "es"]),
  format: z.enum(["pdf", "docx"]), template: z.enum(["clean", "classic", "compact"]),
});
export type ResumeGenerationRequest = z.infer<typeof generationSchema>;
