import { describe,expect,it } from "vitest";
import { compareResume } from "@/lib/matching";
import { makeManualJob, normalizeJob } from "@/lib/jobs/normalize";
import { emptyPreferences,emptyResume } from "@/lib/schema";
import { technologyKey, technologiesIn } from "@/lib/terms";
import { fixtureJob,leverBoard,leverPosting } from "./fixtures/jobs";

describe("comparação determinística",()=>{
  const resume = {...emptyResume,location:"São Paulo, Brasil",languages:["Inglês avançado"],technologies:["JS","React","TypeScript"],
    desiredRoles:["Engenheira de software sênior"],previousRoles:["Software Engineer"],experience:["Estúdio Técnico | 2020–2025"],
    education:["Bacharelado em Computação"]};

  it("unifica abreviações e preserva tecnologias diferentes",()=>{
    expect(technologiesIn("JS, TS, React.js, Node, Postgres, C++, C#, .NET e React Native")).toEqual(
      [".NET","C#","C++","JavaScript","Node.js","PostgreSQL","React","React Native","TypeScript"],
    );
    expect(technologiesIn("other javascriptable postcode")).toEqual([]);
    expect(technologyKey("Postgres")).toBe(technologyKey("PostgreSQL"));
  });

  it("identifica habilidades, idioma, cargo e requisitos correspondentes",()=>{
    const result = compareResume(resume,fixtureJob,emptyPreferences);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.matchingSkills).toEqual(["React","TypeScript"]);
    expect(result.requiredMet).toHaveLength(2);
    expect(result.requiredMissing).toEqual([]);
    expect(result.penalty).toBe(0);
  });

  it("penaliza requisitos obrigatórios sem evidência",()=>{
    const result = compareResume({...resume,technologies:["React"],languages:[]},fixtureJob,emptyPreferences);
    expect(result.score).toBeLessThan(70);
    expect(result.missingSkills).toContain("TypeScript");
    expect(result.requiredMissing).toHaveLength(2);
    expect(result.penalty).toBeGreaterThan(0);
  });

  it("distingue idiomas, formação e experiência de competências técnicas",()=>{
    const job = makeManualJob("manual","Requisitos:\nBacharelado em Computação\n5 anos de experiência\nInglês avançado\n\nDiferenciais:\nDocker");
    const result = compareResume(resume,job,emptyPreferences);
    expect(result.requiredMet).toHaveLength(3);
    expect(result.breakdown.map(item=>item.criterion)).toEqual(expect.arrayContaining(["education","experience","language","preferred"]));
    expect(result.missingSkills).toContain("Docker");
  });

  it("considera restrição geográfica e modalidade",()=>{
    const job = normalizeJob(leverBoard,leverPosting)!;
    const result = compareResume(resume,job,{...emptyPreferences,workModes:["onsite"]});
    expect(result.breakdown.find(x=>x.criterion==="location")?.value).toBe(0);
    expect(result.breakdown.find(x=>x.criterion==="workMode")?.value).toBe(0);
    expect(result.recommendations.join(" ")).toContain("Brasil");
  });

  it("sinaliza ausência de evidência em perfis e anúncios incompletos",()=>{
    const result = compareResume(emptyResume,makeManualJob("manual","Venha conhecer esta oportunidade em nosso time de operações."),emptyPreferences);
    expect(result.hasEvidence).toBe(false);
    expect(result.score).toBe(0);
  });
});
