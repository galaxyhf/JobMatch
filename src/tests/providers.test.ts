import { afterEach,describe,expect,it,vi } from "vitest";
import { fixtureJob,posting,testUuid } from "./fixtures/jobs";

afterEach(()=>{
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("conectores sob falha",()=>{
  it("mantém vagas disponíveis perante 429 e evita repetir consultas em cache",async()=>{
    vi.stubEnv("JOB_BOARDS",JSON.stringify([
      {source:"greenhouse",slug:"board-cache",company:"Quadro disponível"},
      {source:"lever",slug:"board-limit",company:"Quadro com limite"},
    ]));
    const fetch = vi.fn(async (url:string)=>url.includes("greenhouse.io") ? Response.json({jobs:[posting]}) :
      new Response(null,{status:429,headers:{"Retry-After":"60"}}));
    vi.stubGlobal("fetch",fetch);
    const { fetchCatalog } = await import("@/lib/jobs/providers");
    const result = await fetchCatalog(["greenhouse","lever"]);
    expect(result.jobs).toHaveLength(1);
    expect(result.partial).toBe(true);
    expect(result.boards.map(board=>board.status)).toEqual(["ok","error"]);
    expect(await fetchCatalog(["greenhouse","lever"])).toMatchObject({partial:true});
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({redirect:"error",cache:"no-store",signal:expect.any(AbortSignal)}));
  });

  it("mantém o cache recente durante indisponibilidade temporária",async()=>{
    vi.stubEnv("JOB_BOARDS",JSON.stringify([{source:"greenhouse",slug:"board-temporary",company:"Empresa"}]));
    vi.useFakeTimers();
    try {
      const fetch = vi.fn()
        .mockResolvedValueOnce(Response.json({jobs:[posting]}))
        .mockRejectedValueOnce(new Error("timeout"));
      vi.stubGlobal("fetch",fetch);
      const { fetchCatalog } = await import("@/lib/jobs/providers");
      const first = await fetchCatalog(["greenhouse"]);
      expect(first.boards[0].status).toBe("ok");
      vi.setSystemTime(Date.now()+6*60_000);
      const result = await fetchCatalog(["greenhouse"]);
      expect(result.boards[0].status).toBe("stale");
      expect(result.jobs).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  it("reúne vagas dos quadros e do HTML público do LinkedIn na resposta de busca",async()=>{
    vi.stubEnv("JOB_BOARDS",JSON.stringify([{source:"greenhouse",slug:"empresa",company:"Empresa de Teste"}]));
    const fetch = vi.fn(async (url:string)=>{
      if (url.includes("greenhouse.io")) return Response.json({jobs:[posting]});
      if (url.includes("/jobs/view/analista-123")) return new Response(`
        <script type="application/ld+json">
          {"@type":"JobPosting","title":"Analista de Dados","hiringOrganization":{"name":"Empresa & Dados"},
           "description":"&lt;p&gt;Experiência com SQL e Python.&lt;/p&gt;","jobLocationType":"TELECOMMUTE",
           "jobLocation":{"address":{"addressCountry":"BR","addressLocality":"São Paulo"}}}
        </script>`);
      return new Response(`<!DOCTYPE html><li><div class="job-search-card" data-entity-urn="urn:li:jobPosting:123">
        <a class="base-card__full-link" href="https://br.linkedin.com/jobs/view/analista-123?trackingId=abc"></a>
        <h3 class="base-search-card__title">Analista de Dados</h3>
        <h4 class="base-search-card__subtitle"><a>Empresa &amp; Dados</a></h4>
        <span class="job-search-card__location">São Paulo, Brazil</span>
        <time datetime="2026-11-23">1 day ago</time></div></li>`);
    });
    vi.stubGlobal("fetch",fetch);
    const { GET } = await import("@/app/api/jobs/search/route");
    const { getCatalogJob } = await import("@/lib/jobs/providers");
    const response = await GET(new Request("https://jobmatch.invalid/api/jobs/search?keywords=Dados&country=BR&publicationPeriod=week"));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.jobs.map((job:typeof fixtureJob)=>job.source)).toEqual(["greenhouse","linkedin"]);
    expect(result.jobs[1]).toMatchObject({id:"linkedin:123",title:"Analista de Dados",company:"Empresa & Dados",country:"BR",
      publishedAt:"2026-11-23T00:00:00.000Z",applicationUrl:"https://br.linkedin.com/jobs/view/analista-123"});
    const url = new URL(fetch.mock.calls.find(([url])=>url.includes("/seeMoreJobPostings/search"))![0]);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({keywords:"Dados",location:"Brazil",geoId:"106057199",f_TPR:"r604800"});
    expect(await getCatalogJob("linkedin:123")).toMatchObject({
      description:"Experiência com SQL e Python.", technologies:expect.arrayContaining(["SQL","Python"]), workMode:"remote",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("segue apenas o redirecionamento público do mesmo anúncio ao abrir um detalhe sem cache",async()=>{
    const canonical = "https://br.linkedin.com/jobs/view/analista-123";
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.redirect(canonical,301))
      .mockResolvedValueOnce(new Response('<script type="application/ld+json">{"@type":"JobPosting","title":"Analista","hiringOrganization":{"name":"Empresa"}}</script>'))
      .mockResolvedValueOnce(Response.redirect("https://example.com/jobs/view/999",301));
    vi.stubGlobal("fetch",fetch);
    const { getCatalogJob } = await import("@/lib/jobs/providers");
    expect(await getCatalogJob("linkedin:123")).toMatchObject({sourceUrl:canonical});
    expect(fetch).toHaveBeenNthCalledWith(2,canonical,expect.objectContaining({redirect:"error"}));
    await expect(getCatalogJob("linkedin:999")).rejects.toMatchObject({status:503});
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("preserva a busca dos quadros quando a listagem pública do LinkedIn falha",async()=>{
    vi.stubEnv("JOB_BOARDS",JSON.stringify([{source:"greenhouse",slug:"empresa",company:"Empresa"}]));
    vi.stubGlobal("fetch",vi.fn(async (url:string)=>url.includes("linkedin.com") ?
      new Response(null,{status:429}) : Response.json({jobs:[posting]})));
    const { fetchCatalog } = await import("@/lib/jobs/providers");
    const result = await fetchCatalog([]);
    expect(result.jobs.map(job=>job.source)).toEqual(["greenhouse"]);
    expect(result.boards).toContainEqual({source:"linkedin",company:"LinkedIn",status:"error",count:0});
    expect(result.partial).toBe(true);
  });

  it("encaminha apenas quadros autorizados e oferece fallback sem buscar a URL original",async()=>{
    const fetch = vi.fn().mockRejectedValue(new Error("redirect blocked"));
    vi.stubGlobal("fetch",fetch);
    const { POST } = await import("@/app/api/jobs/analyze/route");
    const analyze = (data:unknown)=>POST(new Request("https://jobmatch.invalid/api/jobs/analyze",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),
    }));
    const unsupported = await analyze({url:"https://www.linkedin.com/jobs/view/123"});
    expect(unsupported.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
    const official = await analyze({url:`https://jobs.lever.co/empresa/${testUuid}`});
    expect(official.status).toBe(422);
    expect(fetch).toHaveBeenCalledWith(`https://api.lever.co/v0/postings/empresa/${testUuid}?mode=json`,expect.any(Object));
    const manual = await analyze({description:"Requisitos:\nExperiência com React e cursos de TypeScript.",title:"Engenharia de software"});
    expect(manual.status).toBe(200);
    expect((await manual.json()).job).toMatchObject({source:"manual",technologies:["React","TypeScript"],applicationUrl:null});
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reserva a rota de geração com HTTP 501",async()=>{
    const { POST } = await import("@/app/api/resume/generate/route");
    const { emptyResume } = await import("@/lib/schema");
    const response = await POST(new Request("https://jobmatch.invalid/api/resume/generate",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({resume:emptyResume,job:fixtureJob,language:"pt-BR",format:"pdf",template:"clean"}),
    }));
    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({code:"AI_NOT_CONFIGURED"});
  });
});
