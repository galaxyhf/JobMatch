import type { Job, ParsedResume, Preferences } from "./schema";
import { countryName, countriesIn, languagesIn, seniorityIn, technologiesIn, technologyKey, terms } from "./terms";
import { fold, unique } from "./utils";

const educationPattern = /\b(bachelor(?:'s)?|master(?:'s)?|degree|phd|bacharel(?:ado)?|graduacao|ensino superior|mestrado|doutorado|licenciatura)\b/;
const yearsPattern = /\b(\d{1,2})\s*\+?\s*(?:years?|anos?)\b/g;
const softTerms = [
  "comunicação","communication","trabalho em equipe","teamwork","liderança","leadership","análise de dados",
  "data analysis","gestão de projetos","project management","atendimento ao cliente","customer service",
  "resolução de problemas","problem solving","metodologias ágeis","agile","scrum","negociação","negotiation",
];
const levels = ["intern","junior","mid","senior","lead"] as const;
const aliases: Record<string,string> = {
  communication:"comunicacao", teamwork:"trabalho em equipe", leadership:"lideranca", "data analysis":"analise de dados",
  "project management":"gestao de projetos","customer service":"atendimento ao cliente",
  "problem solving":"resolucao de problemas",agile:"metodologias ageis",negotiation:"negociacao",
};
const skillKey = (value: string) => aliases[fold(value)] ?? technologyKey(value);

function skillPhrases(text: string, custom: string[]) {
  const haystack = fold(text).replace(/[^\p{L}\p{N}+#.]+/gu," ");
  return unique([...softTerms,...custom.filter(item=>item.length>=3 && item.length<=80)].filter(item=>{
    const word = fold(item).replace(/[^\p{L}\p{N}+#.]+/gu," ");
    return ` ${haystack} `.includes(` ${word} `);
  }));
}

export const matchWeights = {
  skills:26, role:17, seniority:8, experience:9, education:7, language:8, location:7, workMode:5, required:18, preferred:5,
};
export type MatchCriterion = keyof typeof matchWeights;
export type MatchResult = ReturnType<typeof compareResume>;

const educationLevel = (text: string) => {
  const value = fold(text);
  if (/\b(phd|doutorado|doctoral|doctorate)\b/.test(value)) return 3;
  if (/\b(master(?:'s)?|mestrado|msc|mba)\b/.test(value)) return 2;
  if (educationPattern.test(value) || /\b(tecnologo|bacharelado)\b/.test(value)) return 1;
  return 0;
};
const yearNumbers = (value: string) => [...fold(value).matchAll(yearsPattern)].map(match=>Number(match[1])).filter(year=>year>0 && year<55);

function experienceYears(resume: ParsedResume) {
  const stated = Math.max(0,...yearNumbers(resume.summary));
  const now = new Date().getFullYear();
  const intervals = resume.experience.flatMap(line => Array.from(line.matchAll(
    /\b((?:19|20)\d\d)\s*(?:[-–—]|a|to|ate|até)\s*((?:19|20)\d\d|atual(?:mente)?|presente|present|current)\b/gi,
  )).map(match => [Number(match[1]),Number(match[2]) || now]));
  const merged = new Set<number>();
  for (const [start,end] of intervals) {
    if (start > end || end > now || start < now-55) continue;
    for (let year = start; year < end; year++) merged.add(year);
  }
  return Math.max(stated,merged.size);
}

function roleSimilarity(role: string, expected: string) {
  const first = terms(role);
  const second = terms(expected);
  if (!first.length || !second.length) return 0;
  const common = first.filter(term=>second.includes(term)).length;
  return Math.min(1,common / Math.max(first.length,second.length*0.75));
}

export function compareResume(resume: ParsedResume, job: Job, preferences: Preferences, weights = matchWeights) {
  const context = [resume.summary,...resume.experience,...resume.projects,...resume.technologies,...resume.skills].join("\n");
  const strengths = new Set([...technologiesIn(context),...resume.skills,...resume.technologies,...skillPhrases(context,[])].map(skillKey));
  const jobSkills = unique([...job.technologies,...skillPhrases(job.description,resume.skills)]);
  const matchingSkills = jobSkills.filter(skill=>strengths.has(skillKey(skill)));
  const missingSkills = jobSkills.filter(skill=>!strengths.has(skillKey(skill)));
  const hasLanguage = new Set(languagesIn(resume.languages.join(" ")));
  const years = experienceYears(resume);
  const education = educationLevel(resume.education.join(" "));

  function evidence(line: string) {
    const checks: boolean[] = [];
    const alternatives = line.split(/\s+(?:or|ou)\s+/i);
    const tech = alternatives.map(part=>unique([...technologiesIn(part),...skillPhrases(part,resume.skills)])).filter(items=>items.length);
    if (tech.length) checks.push(tech.some(items=>items.every(skill=>strengths.has(skillKey(skill)))));
    const languages = alternatives.map(languagesIn).filter(items=>items.length);
    if (languages.length) checks.push(languages.some(items=>items.every(language=>hasLanguage.has(language))));
    const degree = educationLevel(line);
    if (degree) checks.push(education >= degree);
    const neededYears = Math.max(0,...yearNumbers(line));
    if (neededYears) checks.push(years >= neededYears);
    return { met: checks.length > 0 && checks.every(Boolean), recognized: checks.length > 0 };
  }

  const requiredMet = job.required.filter(line=>evidence(line).met);
  const requiredMissing = job.required.filter(line=>!evidence(line).met);
  const confirmedMissing = requiredMissing.filter(line=>evidence(line).recognized);
  const scoredRequirements = requiredMet.length + confirmedMissing.length;
  const preferredIdentified = job.preferred.filter(line=>evidence(line).recognized);
  const preferredMet = preferredIdentified.filter(line=>evidence(line).met).length;
  const neededYears = Math.max(0,...job.required.flatMap(yearNumbers));
  const requiredEducation = Math.max(0,...job.required.map(educationLevel));
  const roles = unique([preferences.role,...resume.desiredRoles,...resume.previousRoles].filter(Boolean));
  const personLevel = roles.map(seniorityIn).find(Boolean);
  const h = Math.max(0,...roles.map(role=>roleSimilarity(role,job.title)));
  const candidateCountry = countriesIn(resume.location)[0];
  const allowed = job.geography.eligibleCountries;
  const geography = candidateCountry && (
    (candidateCountry === "BR" && job.geography.excludesBrazil) ||
    (allowed.length > 0 && job.geography.status !== "worldwide")
  );
  const city = preferences.city || resume.location.split(",")[0]?.trim() || "";
  const cityMatch = city && job.location && job.workMode !== "remote"
    ? Number(fold(job.location).includes(fold(city))) : undefined;
  const countryMatch = candidateCountry && job.geography.status === "worldwide" ? 1
    : geography ? Number(allowed.includes(candidateCountry!)) : undefined;

  const breakdown: { criterion: MatchCriterion; value: number; reason: string }[] = [];
  const add = (criterion: MatchCriterion, value: number, reason: string) => breakdown.push({criterion,value,reason});
  if (jobSkills.length) add("skills",matchingSkills.length/jobSkills.length,`${matchingSkills.length} de ${jobSkills.length} habilidades identificadas nas duas descrições.`);
  if (roles.length) add("role",h,h>=0.65 ? "Os termos do cargo correspondem ao perfil." : "Os termos do cargo têm pouca correspondência no currículo.");
  if (job.seniority && personLevel) {
    const difference = Math.abs(levels.indexOf(job.seniority)-levels.indexOf(personLevel));
    add("seniority",Math.max(0,1-difference*0.42),difference===0 ? "A senioridade indicada coincide." : "Há diferença entre os níveis indicados.");
  }
  if (neededYears) add("experience",Math.min(1,years/neededYears),`Experiência geral identificada: ${years} ano(s). A vaga cita ${neededYears} ano(s) nos requisitos.`);
  if (requiredEducation) add("education",Number(education>=requiredEducation),"O nível de formação foi comparado com as informações da seção de requisitos.");
  if (job.languages.length) {
    const matches = job.languages.filter(language=>hasLanguage.has(language)).length;
    add("language",matches/job.languages.length,`${matches} de ${job.languages.length} idioma(s) da vaga identificado(s) no currículo.`);
  }
  if (countryMatch !== undefined || cityMatch !== undefined) {
    add("location",countryMatch === 0 ? 0 : (cityMatch ?? countryMatch ?? 0),
      countryMatch === 0 ? `O anúncio indica restrições para a localização informada (${countryName(candidateCountry!)}).`
        : "A localização informada foi comparada com a área anunciada.");
  }
  if (preferences.workModes.length && job.workMode !== "unknown") {
    add("workMode",Number(preferences.workModes.includes(job.workMode)),"A modalidade anunciada foi comparada com suas preferências.");
  }
  if (scoredRequirements) add("required",requiredMet.length/scoredRequirements,`${requiredMet.length} de ${scoredRequirements} requisitos verificáveis têm sinais no currículo.`);
  if (preferredIdentified.length) add("preferred",preferredMet/preferredIdentified.length,`${preferredMet} de ${preferredIdentified.length} diferenciais verificáveis têm sinais no currículo.`);
  const denominator = breakdown.reduce((sum,item)=>sum+weights[item.criterion],0);
  const raw = denominator ? breakdown.reduce((sum,item)=>sum+item.value*weights[item.criterion],0)/denominator*100 : 0;
  const penalty = scoredRequirements ? Math.min(24, 4*confirmedMissing.length + 10*confirmedMissing.length/scoredRequirements) : 0;
  const score = Math.round(Math.max(0,Math.min(100,raw-penalty-(countryMatch===0 ? 12:0))));
  const recommendations = [
    ...(requiredMissing.length ? ["Confira os requisitos não identificados. Atualize seu currículo apenas com experiências e habilidades reais."] : []),
    ...(job.workMode === "remote" && job.geography.status !== "worldwide" ?
      [job.geography.includesBrazil ? "Confira as condições regionais e de contratação no anúncio." : "Confirme com a empresa se a vaga aceita candidatos no Brasil."] : []),
    ...(job.languages.length ? ["Verifique o nível de proficiência solicitado para cada idioma."] : []),
    ...(!breakdown.length ? ["Inclua mais detalhes no currículo e consulte a descrição original para avaliar os requisitos."] : []),
  ];
  return {score,hasEvidence:denominator>0,matchingSkills,missingSkills,requiredMet,requiredMissing,penalty,breakdown,recommendations};
}
