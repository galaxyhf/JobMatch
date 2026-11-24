import { emptyResume, type ParsedResume } from "../schema";
import { technologiesIn } from "../terms";
import { fold, unique } from "../utils";

type Section = "summary" | "experience" | "education" | "skills" | "languages" | "certifications" | "projects" | "previousRoles" | "technologies";
const sections: Record<Section, RegExp> = {
  summary:/^(?:(?:resumo|perfil)(?: profissional)?|objetivo(?: profissional)?|sobre mim|summary|professional summary|profile|about me)$/i,
  experience:/^(?:experiencia(?:s)?(?: profissional| profissionais| de trabalho)?|historico profissional|work experience|employment history|professional experience|experience)$/i,
  education:/^(?:formacao(?: academica)?|educacao|escolaridade|education(?:al background)?|academic background)$/i,
  skills:/^(?:habilidades(?: tecnicas)?|competencias(?: tecnicas)?|skills|technical skills|core competencies|qualificacoes)$/i,
  technologies:/^(?:tecnologias(?: e ferramentas)?|technologies|tech stack|ferramentas|tools)$/i,
  languages:/^(?:idiomas|linguas|languages|language skills)$/i,
  certifications:/^(?:certificacoes|cursos(?: e certificacoes)?|certificados|certifications|courses(?: and certifications)?|certificates)$/i,
  projects:/^(?:projetos(?: pessoais| academicos)?|projects|personal projects|selected projects)$/i,
  previousRoles:/^(?:cargos(?: anteriores)?|previous roles|roles)$/i,
};
const email = /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+\b/i;
const phone = /(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,3}\)[\s.-]?|\d{2,3}[\s.-])?\d{4,5}[\s.-]?\d{4}(?!\d)/;
const role = /\b(desenvolvedor[ae]?|developer|engineer|engenheir[oa]|analista|analyst|consult(?:ant|or[ae]?)|gerente|manager|designer|especialista|specialist|coordenador[ae]?|estagiari[oa]|intern|tecnic[oa]|assistente|assistant|director|diretor[ae]?)\b/;
const cleanLine = (line: string) => line.trim().replace(/^[•◦▪●\u200b\ufeff\t ]+|^[-–]\s+/g,"").trim();
const listLines = (lines: string[]) => unique(lines.map(line => line.slice(0,500)).filter(Boolean)).slice(0,100);

export function parseResume(raw: string): ParsedResume {
  const result: ParsedResume = {...emptyResume};
  const lines = raw.normalize("NFKC").replace(/\r/g,"").split("\n").map(cleanLine).filter(Boolean);
  const collected: Record<Section,string[]> = {
    summary:[], experience:[], education:[], skills:[], languages:[], certifications:[], projects:[], previousRoles:[], technologies:[],
  };
  const header: string[] = [];
  let active: Section | undefined;
  for (const line of lines) {
    const [label, ...rest] = line.split(/[:：]/);
    const next = (Object.keys(sections) as Section[]).find(key => sections[key].test(fold(label.trim())));
    if (next) {
      active = next;
      const inline = rest.join(":").trim();
      if (inline) collected[active].push(inline);
    } else if (active) {
      collected[active].push(line);
    } else {
      header.push(line);
    }
  }
  result.email = raw.match(email)?.[0].slice(0,254) ?? "";
  result.phone = header.slice(0,15).join("\n").match(phone)?.[0] ?? "";
  const explicitName = header.find(line => /^(nome|name)\s*:/i.test(line))?.split(":").slice(1).join(":").trim();
  result.name = (explicitName || header.slice(0,7).find(line =>
    /^[\p{L}][\p{L}\p{M}'’ .-]{2,89}$/u.test(line) &&
    line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 8 &&
    !role.test(fold(line)) && !/\b(curriculo|curriculum|resume|contact|contato)\b/.test(fold(line)),
  ) || "").slice(0,300);
  result.location = (header.find(line => /^(?:localiza[cç][aã]o|location|cidade|city|resid[eê]ncia)\s*:/i.test(line))
    ?.split(":").slice(1).join(":").trim() || header.slice(0,12).find(line =>
    /^[\p{L}][\p{L}\p{M} .'-]{2,65},\s*(?:[A-Z]{2}|Brasil|Brazil|Portugal|Canada|USA)$/u.test(line),
  ) || "").slice(0,300);

  for (const key of ["experience","education","certifications","projects"] as const) result[key] = listLines(collected[key]);
  for (const key of ["skills","languages"] as const) {
    result[key] = listLines(collected[key].flatMap(line => line.split(/[,;|]/).map(cleanLine)));
  }
  result.technologies = listLines([...technologiesIn(raw), ...collected.technologies.flatMap(line => line.split(/[,;|]/).map(cleanLine))]);
  result.previousRoles = listLines([
    ...collected.previousRoles,
    ...[...header.slice(0,8), ...collected.experience].filter(line => line.length <= 115 && role.test(fold(line)) &&
      !/^(?:responsavel|responsible|worked|trabalhei|atuei|led|lideranca|desenvolvimento)\b/.test(fold(line))),
  ]);
  result.summary = collected.summary.join("\n").slice(0,6000);
  return result;
}
