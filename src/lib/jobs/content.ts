import { convert } from "html-to-text";
import { countriesIn, languagesIn, seniorityIn, technologiesIn } from "../terms";
import { compact, fold, unique } from "../utils";
import type { Job } from "../schema";

const htmlOptions: Parameters<typeof convert>[1] = {
  wordwrap:false,
  selectors: [
    {selector:"a",options:{ignoreHref:true}},
    ...["img","style","script","iframe","svg","object","video"].map(selector => ({selector,format:"skip"})),
  ],
  limits:{maxInputLength:240_000, maxDepth:80, maxChildNodes:7000},
};

export function plainHtml(html: string, escaped = false) {
  const source = escaped && !/<[a-z][^>]*>/i.test(html) && /&lt;[a-z]/i.test(html)
    ? convert(html, htmlOptions)
    : html;
  return convert(source,htmlOptions).replace(/\n{3,}/g,"\n\n").trim();
}

const headings = {
  required:/^(?:(?:(?:minimum|basic|required) )?(?:requirements|qualifications)|(?:job |minimum |basic )?requirements|requisitos(?: (?:obrigatorios|minimos|necessarios))?|qualificacoes(?: obrigatorias)?|what you(?:'ll| will) need|what you bring(?: to (?:the table|this role))?|what we(?:'re| are) looking for|o que (?:voce precisa|buscamos|esperamos)(?: de voce)?|para (?:esta|essa) vaga)$/,
  preferred:/^(?:preferred (?:requirements|qualifications|skills)|nice to have|nice-to-have|bonus points(?: if you have)?|diferenciais|desejaveis|requisitos desejaveis|qualificacoes desejaveis|seria um diferencial)$/,
  responsibilities:/^(?:responsabilidades(?: e atribuicoes)?|atribuicoes|atividades|o que voce (?:vai|ira) fazer|como sera seu dia a dia|(?:key |job )?responsibilities|what you(?:'ll| will) do|what you will be doing|in this role,? you will)$/,
  benefits:/^(?:beneficios|benefits|perks(?: and benefits)?|what we offer(?: you)?|o que oferecemos|compensation and benefits)$/,
};
type Section = keyof typeof headings;
const otherHeading = /^(?:about (?:us|the role|the team|the job)|sobre (?:a empresa|nos|a vaga|o time)|compensation|salary|additional information|informacoes adicionais|how to apply|como se candidatar|equal opportunity(?: employer)?)$/;

function sectionLines(description: string) {
  const result: Record<Section, string[]> = {required:[],preferred:[],responsibilities:[],benefits:[]};
  let section: Section | undefined;
  for (const raw of description.split("\n")) {
    const line = raw.trim().replace(/^(?:[•●◦▪*–-]+|\d+[.)])\s*/,"").trim();
    if (!line) continue;
    const [label,...inline] = line.split(":");
    const normalized = fold(label).replace(/^[#\s]+/,"").trim();
    const next = (Object.keys(headings) as Section[]).find(key => headings[key].test(normalized));
    if (next) {
      section = next;
      const remainder = inline.join(":").trim();
      if (remainder) result[next].push(remainder);
    } else if (otherHeading.test(normalized) ||
      (line.length < 75 && /^[A-ZÀ-Ý\s]{5,}$/.test(line) && !line.includes("  "))) {
      section = undefined;
    } else if (section) {
      result[section].push(line);
    }
  }
  const sanitized = Object.fromEntries(Object.entries(result).map(([key, values]) => [key, unique(values.map(value => value.slice(0,500))).slice(0,40)])) as typeof result;
  return sanitized;
}

export function workModeIn(location: string, description: string): Job["workMode"] {
  const where = fold(location);
  const text = fold(description);
  if (/\b(hybrid|hibrid[oa])\b/.test(where)) return "hybrid";
  if (/\b(on[ -]?site|presencial|in[ -]office)\b/.test(where)) return "onsite";
  if (/\b(remote|remot[oa])\b/.test(where)) return "remote";
  const explicit = text.match(/\b(?:this (?:position|role) is|(?:workplace|work model|modalidade|modelo de trabalho)\s*:|vaga (?:e\s+)?|trabalho)\s*(?:fully\s+|100%\s+)?(hybrid|hibrid[oa]|on[ -]?site|presencial|remote|remot[oa])\b/)?.[1];
  if (explicit) return workModeIn(explicit, "");
  return "unknown";
}

export function employmentIn(value: string, description = "") {
  const key = fold(value).replace(/[\s_-]+/g,"");
  const known: Record<string,string> = {
    fulltime:"fulltime", parttime:"parttime", fulltimeemployee:"fulltime", intern:"intern", internship:"intern", estagio:"intern",
    contract:"contract", contractor:"contract", temporary:"temporary", fixedterm:"temporary", temporaryemployee:"temporary",
    clt:"clt", pj:"pj", integral:"fulltime", meioperiodo:"parttime",
  };
  const labeled = fold(description).match(/\b(?:contratacao|regime|tipo de contrato)\s*:\s*(clt|pj)\b/)?.[1];
  return (labeled ?? known[key] ?? (value.trim() || null)) as string | null;
}

function geographyFor(workMode: Job["workMode"], location: string, country: string | null, description: string, structuredCountries: string[]): Job["geography"] {
  const where = fold(location);
  const lines = description.split(/\n+|(?<=[.!?])\s+(?=[A-ZÀ-Ý])/).map(compact).filter(Boolean);
  const restrictions = lines.filter(line => {
    const value = fold(line);
    return /\b(?:must (?:be|reside|live)\s+(?:based\s+)?in|(?:candidates?|applicants?)\s+(?:must be located|must be based|based|located)\s+in|only (?:open|available)\s+to|only in|(?:located|based) in .{2,65} only|remote (?:only |within |in |from )|eligible locations|residir (?:em|no|na)|apenas (?:em|no|na)|remot[oa] (?:no|na|em|para)|time ?zone|fuso horario|US only|not (?:available|open) in)\b/i.test(value);
  }).slice(0,12);
  const hasGlobal = /\b(worldwide|anywhere in the world|global remote|qualquer lugar do mundo|remoto global)\b/.test(where) ||
    lines.some(line => /\b(?:work|hire|open to applicants|remote)\b.{0,90}\b(?:worldwide|anywhere in the world)\b|\b(?:trabalhe|remoto)\b.{0,90}\bqualquer lugar do mundo\b/.test(fold(line)));
  const namedCountries = unique([...structuredCountries,...countriesIn(location)]);
  const regional = /\b(latam|latin america|america latina|south america|america do sul|emea|apac|north america|america do norte|europe|europa|united states|usa only)\b/;
  const regionalCodes: [RegExp,string[]][] = [
    [/\b(latam|latin america|america latina)\b/,["BR","AR","CL","CO","CR","MX","PE","UY"]],
    [/\b(south america|america do sul)\b/,["BR","AR","CL","CO","PE","UY"]],
    [/\b(north america|america do norte)\b/,["US","CA","MX"]],
    [/\b(europe|europa|emea)\b/,["GB","PT","IE","ES","FR","DE","IT","NL","BE","CH","SE","NO","FI","DK","PL"]],
    [/\bapac\b/,["AU","NZ","IN","JP","CN","KR","SG","PH"]],
  ];
  const negative = /\b(?:except|excluding|excludes|not (?:available|open|eligible)|exceto|exclui|fora do)\b/;
  const excludesBrazil = [location,...lines]
    .some(line => negative.test(fold(line)) && countriesIn(line).includes("BR"));
  const explicitScope = /\b(?:must (?:be|reside|live)\s+(?:based\s+)?in|(?:candidates?|applicants?)\s+(?:must be located|must be based)\s+in|only (?:open|available)\s+to|only in|(?:located|based) in .{2,65} only|us only|residir (?:em|no|na)|apenas (?:em|no|na))\b/;
  const affirmative = restrictions.filter(line=>!negative.test(fold(line)));
  function codesFor(lines: string[]) {
    const geographyText = fold(lines.join(" "));
    return unique([
      ...lines.flatMap(countriesIn),
      ...regionalCodes.filter(([pattern])=>pattern.test(geographyText)).flatMap(([,codes])=>codes),
    ]);
  }
  const locationScope = codesFor([location,...(country ? [country] : []),...namedCountries]);
  const restrictionScope = codesFor(affirmative.filter(line=>explicitScope.test(fold(line))));
  const regionalScope = codesFor(affirmative);
  const explicitlyRestricted = restrictions.length > 0 || regional.test(where) || locationScope.length>0;
  const eligibleCountries = (restrictionScope.length ? restrictionScope : unique([...locationScope,...regionalScope]))
    .filter(code=>code!=="BR" || !excludesBrazil).slice(0,50);
  const status = hasGlobal && !explicitlyRestricted && !excludesBrazil
    ? "worldwide"
    : explicitlyRestricted || excludesBrazil ? "restricted" : "unspecified";
  return {
    status, eligibleCountries, excludesBrazil,
    includesBrazil: !excludesBrazil && (status === "worldwide" || eligibleCountries.includes("BR")),
    evidence: unique([
      ...(location && (workMode === "remote" || regional.test(where)) ? [location] : []),
      ...restrictions.map(line => line.slice(0,500)),
    ]),
  };
}

export function contentFields(title: string, description: string, location: string, country: string | null, mode?: Job["workMode"], structuredCountries: string[] = []) {
  const workMode = mode && mode !== "unknown" ? mode : workModeIn(location,description);
  const {required,preferred,responsibilities,benefits} = sectionLines(description);
  return {
    workMode, seniority:seniorityIn(title), required, preferred, responsibilities, benefits,
    requirements:unique([...required,...preferred]),
    technologies:technologiesIn(title + "\n" + description),
    languages:languagesIn([...required,...preferred,...description.split("\n").filter(line => /\b(fluent|fluen\w+|proficiency|proficiencia|bilingual|bilingue|ingles avancado|ingles intermediario)\b/.test(fold(line)))].join("\n")),
    geography:geographyFor(workMode,location,country,description,structuredCountries),
  };
}
