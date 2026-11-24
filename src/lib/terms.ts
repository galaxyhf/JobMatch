import type { Job } from "./schema";
import { fold, unique } from "./utils";

const technologyAliases: Record<string, string[]> = {
  JavaScript:["javascript","ecmascript","js"], TypeScript:["typescript","ts"], React:["react.js","reactjs","react"],
  "Node.js":["node.js","nodejs","node"], PostgreSQL:["postgresql","postgres"], "Next.js":["next.js","nextjs"],
  Python:["python"], Java:["java"], Kotlin:["kotlin"], Swift:["swift"], PHP:["php"], Ruby:["ruby"], Rust:["rust"],
  Go:["golang","go language","go programming"], "C#":["c#","c sharp"], "C++":["c++","cpp"],
  ".NET":[".net","dotnet","asp.net"], HTML:["html","html5"], CSS:["css","css3"],
  Tailwind:["tailwind css","tailwindcss","tailwind"], Vue:["vue.js","vuejs","vue"], Angular:["angular"], Svelte:["svelte"],
  "React Native":["react native"], Flutter:["flutter"], SQL:["sql"], MySQL:["mysql"], "SQL Server":["sql server","mssql"],
  MongoDB:["mongodb","mongo"], Redis:["redis"], Elasticsearch:["elasticsearch","elastic search"],
  Docker:["docker"], Kubernetes:["kubernetes","k8s"], AWS:["aws","amazon web services"], Azure:["azure"],
  GCP:["gcp","google cloud platform","google cloud"], Terraform:["terraform"], Linux:["linux"], Git:["git"],
  GraphQL:["graphql"], REST:["rest api","restful","rest apis","apis rest","api rest"], Kafka:["kafka"],
  Django:["django"], FastAPI:["fastapi"], Flask:["flask"], Laravel:["laravel"], Rails:["ruby on rails","rails"],
  "Spring Boot":["spring boot"], Spark:["apache spark","pyspark","spark"], "Power BI":["power bi","powerbi"],
  Excel:["excel"], Tableau:["tableau"], Figma:["figma"], Salesforce:["salesforce"], SAP:["sap"],
  "Google Analytics":["google analytics","ga4"], "Google Ads":["google ads"], "Meta Ads":["meta ads","facebook ads"],
  SEO:["seo"], "Machine Learning":["machine learning","aprendizado de maquina"], "CI/CD":["ci/cd","continuous integration"],
  Playwright:["playwright"], Cypress:["cypress"], Jest:["jest"], Vitest:["vitest"], Selenium:["selenium"],
  Snowflake:["snowflake"], Databricks:["databricks"], Airflow:["airflow"], dbt:["dbt"], BigQuery:["bigquery"],
  "NestJS":["nestjs","nest.js"], Express:["express.js","expressjs","express framework"], Prisma:["prisma orm","prisma"],
};
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const aliasLookup = new Map(Object.entries(technologyAliases).flatMap(([name, aliases]) =>
  [name, ...aliases].map(alias => [fold(alias), name] as const),
));
const technologyPattern = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...aliasLookup.keys()].sort((a,b)=>b.length-a.length).map(escapeRegex).join("|")})(?![\\p{L}\\p{N}])`, "gu",
);

export function technologiesIn(text: string) {
  return unique([...fold(text).matchAll(technologyPattern)].map(match => aliasLookup.get(match[0])!)).sort();
}

export function technologyKey(text: string) {
  const key = fold(text).trim();
  return fold(aliasLookup.get(key) ?? key);
}

const languagePatterns = {
  pt:/\b(portuguese|portugues)\b/, en:/\b(english|ingles)\b/, es:/\b(spanish|espanhol|espanol)\b/,
  fr:/\b(french|frances)\b/, de:/\b(german|alemao|deutsch)\b/, it:/\b(italian|italiano)\b/,
  ja:/\b(japanese|japones)\b/, zh:/\b(mandarin|mandarim|chinese|chines)\b/,
};

export function languagesIn(text: string) {
  const value = fold(text);
  return Object.entries(languagePatterns).filter(([,pattern]) => pattern.test(value)).map(([code]) => code);
}

const countryAliases: Record<string, string[]> = {
  BR:["brazil","brasil","sao paulo","belo horizonte","rio de janeiro","curitiba","porto alegre","florianopolis","campinas","recife","brasilia","fortaleza","salvador","barueri"],
  US:["united states","usa","u.s.","new york","san francisco","california","seattle","chicago","boston","austin","houston","atlanta","los angeles","washington dc"],
  CA:["canada","toronto","vancouver","montreal","ontario","quebec"], GB:["united kingdom","uk","reino unido","england","london","londres","scotland"],
  PT:["portugal","lisbon","lisboa"], DE:["germany","alemanha","berlin","munich","munique"], FR:["france","franca","paris"],
  ES:["spain","espanha","madrid","barcelona"], MX:["mexico"], AR:["argentina","buenos aires"], CO:["colombia","bogota"],
  CL:["chile","santiago de chile"], UY:["uruguay","uruguai","montevideo"], PE:["peru","lima, peru"], CR:["costa rica"],
  IE:["ireland","irlanda","dublin"], NL:["netherlands","paises baixos","amsterdam"], AU:["australia","sydney","melbourne"],
  IN:["india","bengaluru","bangalore","mumbai"], JP:["japan","japao","tokyo"], SG:["singapore","singapura"],
  AE:["united arab emirates","emirados arabes unidos","dubai"], PL:["poland","polonia","warsaw"], IT:["italy","italia","milan","roma"],
  BE:["belgium","belgica","brussels"], CH:["switzerland","suica","zurich"], SE:["sweden","suecia","stockholm"],
  NO:["norway","noruega","oslo"], FI:["finland","finlandia","helsinki"], DK:["denmark","dinamarca","copenhagen"],
  NZ:["new zealand","nova zelandia"], ZA:["south africa","africa do sul"], CN:["china","beijing","shanghai"],
  KR:["south korea","coreia do sul","seoul"], PH:["philippines","filipinas","manila"],
};

export function countriesIn(text: string) {
  const normalized = fold(text);
  const codes = text.split(/[,;|/()]/).map(part => part.trim()).filter(part => /^[A-Z]{2}$/.test(part));
  const explicit = Object.entries(countryAliases).filter(([, aliases]) =>
    aliases.some(alias => new RegExp(`(?<![a-z])${escapeRegex(alias)}(?![a-z])`).test(normalized)),
  ).map(([code]) => code);
  if (explicit.length === 0 && /,\s*(CA|NY|TX|WA|MA|IL|FL|NJ|CO|VA|GA|NC|PA|AZ|MI|OH|OR|UT|NV|WI)\b/.test(text) && !/[,;]\s*BR\b/.test(text)) return ["US"];
  return unique([...explicit, ...codes.filter(code => Object.hasOwn(countryAliases, code) && (explicit.length === 0 || code === "BR"))]);
}

export function countryName(code: string) {
  return new Intl.DisplayNames(["pt-BR"], { type:"region", fallback:"code" }).of(code) ?? code;
}

export const countryOptions = Object.keys(countryAliases).sort((a,b) => countryName(a).localeCompare(countryName(b),"pt-BR"));

export function seniorityIn(text: string): Job["seniority"] {
  const value = fold(text);
  if (/\b(intern(?:ship)?|estagio|estagiario|estagiaria|trainee)\b/.test(value)) return "intern";
  if (/\b(junior|jr|entry.level)\b/.test(value)) return "junior";
  if (/\b(pleno|mid.level|intermediate)\b/.test(value)) return "mid";
  if (/\b(staff|principal|lead|head of|director|gerente|diretor|lider|lideranca)\b/.test(value)) return "lead";
  if (/\b(senior|sr)\b/.test(value)) return "senior";
  return null;
}

const tokensIgnored = new Set("da de do dos das em com para por e a o as os the in for of and to with or senior sr junior jr pleno ii iii".split(" "));
const roleAliases: Record<string,string> = {
  desenvolvedor:"developer", desenvolvedora:"developer", development:"developer", dev:"developer",
  engenharia:"engineer", engenheiro:"engineer", engenheira:"engineer", engineering:"engineer",
  dados:"data", produto:"product", gerente:"manager", design:"designer", analista:"analyst",
  vendas:"sales", analise:"analyst", fullstack:"fullstack", backend:"backend", frontend:"frontend",
};

export function terms(value: string) {
  return unique(fold(value.replace(/\b(back|front|full)[ -]?(end|stack)\b/gi, "$1$2"))
    .match(/[\p{L}\p{N}+#.]+/gu)
    ?.map(word => word.replace(/^\.+|\.+$/g,""))
    .filter(word => word.length > 1 && !tokensIgnored.has(word))
    .map(word => roleAliases[word] ?? technologyKey(word)) ?? []);
}
