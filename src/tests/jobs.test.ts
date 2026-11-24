import { describe,expect,it } from "vitest";
import { catalogPage } from "@/lib/jobs/pagination";
import { passesFilters, sortResults } from "@/lib/jobs/filters";
import { canonicalLink,deduplicate,makeManualJob,normalizeJob } from "@/lib/jobs/normalize";
import { identifyPosting } from "@/lib/jobs/providers";
import { emptyPreferences, preferencesSchema } from "@/lib/schema";
import { safeExternalUrl } from "@/lib/utils";
import { ashbyBoard,ashbyPosting,fixtureJob,greenhouseBoard,leverBoard,leverPosting,posting,testUuid } from "./fixtures/jobs";

describe("normalização das fontes",()=>{
  it("separa HTML e metadados sem usar updated_at como publicação",()=>{
    expect(fixtureJob).toMatchObject({title:"Engenheira de Software Sênior",country:"BR",workMode:"remote",seniority:"senior",
      publishedAt:null,salaryMin:null,benefits:["Auxílio educação"],requirements:["Experiência com React.js e TS","Inglês avançado"],
      languages:["en"],geography:{includesBrazil:true}});
    expect(fixtureJob.description).not.toContain("<li>");
    expect(normalizeJob(greenhouseBoard,{...posting,internal_job_id:null})).toBeNull();
  });

  it("normaliza modalidades, contratação e remuneração do Lever",()=>{
    const job = normalizeJob(leverBoard,leverPosting)!;
    expect(job).toMatchObject({workMode:"remote",country:"US",employmentType:"fulltime",salaryInterval:"year",
      salaryCurrency:"USD",salaryMin:100000,publishedAt:null,geography:{includesBrazil:false,status:"restricted"},
      applicationUrl:leverPosting.applyUrl});
    expect(job.required[0]).toContain("Node.js");
  });

  it("usa publicação e componentes salariais documentados do Ashby",()=>{
    const job = normalizeJob(ashbyBoard,ashbyPosting)!;
    expect(job).toMatchObject({source:"ashby",salaryMin:80000,salaryMax:110000,salaryCurrency:"USD",salaryInterval:"year",
      publishedAt:"2026-01-01T00:00:00.000Z",preferred:["Figma"],geography:{status:"worldwide",includesBrazil:true}});
    expect(job.description).not.toContain("alert(1)");
  });

  it("prioriza a restrição explícita sobre uma localização ampla ou contraditória",()=>{
    const job = normalizeJob(ashbyBoard,{...ashbyPosting,location:"Brasil ou Estados Unidos",
      descriptionHtml:"<p>Applicants must be based in the United States.</p>"})!;
    expect(job.geography).toMatchObject({includesBrazil:false,eligibleCountries:["US"]});
    const unknown = makeManualJob("manual","This role is fully remote. You will work with other engineers.");
    expect(unknown.geography.status).toBe("unspecified");
    expect(passesFilters(unknown,{...emptyPreferences,countries:["BR"]})).toBe(false);
  });
});

describe("deduplicação, paginação e filtros",()=>{
  it("usa identificador, URL canônica e a mesma descrição por empresa e local",()=>{
    const copy = {...fixtureJob,id:"different",sourceUrl:fixtureJob.sourceUrl+"?utm_source=feed",applicationUrl:null};
    expect(deduplicate([fixtureJob,fixtureJob,copy])).toHaveLength(1);
    expect(deduplicate([fixtureJob,{...copy,sourceUrl:"https://example.com/vagas/2"}])).toHaveLength(1);
    const other = {...copy,id:"other",location:"Recife, Brasil",sourceUrl:"https://example.com/vagas/3"};
    expect(deduplicate([fixtureJob,other])).toHaveLength(2);
    expect(canonicalLink("https://jobs.lever.co/company/id/apply?utm_source=x")).toBe("jobs.lever.co/company/id");
  });

  it("valida valores inválidos e filtra termos normalizados de forma combinada",()=>{
    expect(preferencesSchema.safeParse({countries:["BRA"],minMatch:110}).success).toBe(false);
    expect(preferencesSchema.safeParse({salaryMin:-100,workModes:["ultraremote"]}).success).toBe(false);
    const filter = preferencesSchema.parse({role:"engenheiro software",technologies:["TS"],countries:["BR","PT"],
      language:"en",workModes:["remote"],seniorities:["senior"],sources:["greenhouse"]});
    expect(passesFilters(fixtureJob,filter)).toBe(true);
    expect(passesFilters(fixtureJob,{...filter,countries:["US"]})).toBe(false);
    expect(passesFilters(fixtureJob,{...filter,currency:"BRL"})).toBe(false);
    expect(passesFilters(fixtureJob,{...filter,keywords:"equipe"})).toBe(false);
  });

  it("ordena salário em escala comparável por moeda",()=>{
    const jobs = [
      {job:{...fixtureJob,id:"a",salaryMin:10000,salaryCurrency:"BRL",salaryInterval:"month" as const},match:null},
      {job:{...fixtureJob,id:"b",salaryMin:100000,salaryCurrency:"BRL",salaryInterval:"year" as const},match:null},
      {job:{...fixtureJob,id:"c"},match:null},
    ];
    expect(sortResults(jobs,"salary","BRL").map(row=>row.job.id)).toEqual(["a","b","c"]);
  });

  it("mantém o cursor em um mesmo catálogo e rejeita catálogo alterado",()=>{
    const result = {jobs:[{...fixtureJob,id:"a"},{...fixtureJob,id:"b"}],boards:[],partial:false};
    const first = catalogPage(result,undefined,undefined,1024);
    expect(first.next).toBe("a");
    const second = catalogPage(result,first.next!,first.snapshot,1024);
    expect(second.jobs.map(job=>job.id)).toEqual(["b"]);
    expect(second.next).toBeNull();
    expect(()=>catalogPage({...result,jobs:result.jobs.slice(1)},first.next!,first.snapshot)).toThrow(/mudou/);
  });
});

describe("validação de links",()=>{
  it.each(["http://jobs.lever.co","javascript:alert(1)","https://127.0.0.1","https://[::1]","https://localhost",
    "https://site.internal","https://user@jobs.lever.co","https://jobs.lever.co:444","https://jobs.lever.co\\@example.com"])("recusa %s",value=>{
    expect(safeExternalUrl(value)).toBeNull();
  });
  it("só converte rotas públicas conhecidas para consulta automática",()=>{
    expect(identifyPosting(posting.absolute_url)).toMatchObject({id:String(posting.id),board:{source:"greenhouse"}});
    expect(identifyPosting(`https://jobs.eu.lever.co/empresa/${testUuid}/apply`)).toMatchObject({id:testUuid,board:{region:"eu"}});
    expect(identifyPosting(ashbyPosting.applyUrl)).toMatchObject({id:testUuid,board:{source:"ashby"}});
    expect(identifyPosting("https://www.linkedin.com/jobs/view/123")).toBeNull();
    expect(identifyPosting("https://jobs.ashbyhq.com.example.com/empresa/"+testUuid)).toBeNull();
    expect(identifyPosting("https://boards.greenhouse.io/empresa/%2fjobs/90210")).toBeNull();
  });
});
