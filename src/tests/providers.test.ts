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
    const result = await fetchCatalog([]);
    expect(result.jobs).toHaveLength(1);
    expect(result.partial).toBe(true);
    expect(result.boards.map(board=>board.status)).toEqual(["ok","error"]);
    expect(await fetchCatalog([])).toMatchObject({partial:true});
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
      const first = await fetchCatalog([]);
      expect(first.boards[0].status).toBe("ok");
      vi.setSystemTime(Date.now()+6*60_000);
      const result = await fetchCatalog([]);
      expect(result.boards[0].status).toBe("stale");
      expect(result.jobs).toHaveLength(1);
    } finally { vi.useRealTimers(); }
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
