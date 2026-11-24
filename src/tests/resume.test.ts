import { readFile } from "node:fs/promises";
import { afterEach,describe,expect,it,vi } from "vitest";
import { POST } from "@/app/api/resume/parse/route";
import { extractResume, maxUploadBytes } from "@/lib/resume/extract";
import { parseResume } from "@/lib/resume/parser";
import { resumeSchema } from "@/lib/schema";

const upload = async (name:string) => new File(
  [Uint8Array.from(await readFile(new URL(`./fixtures/${name}`,import.meta.url)))],name,
);
const routeRequest = (body:FormData) => new Request("https://jobmatch.invalid/api/resume/parse",{method:"POST",body});

afterEach(()=>vi.restoreAllMocks());

describe("extração real de arquivos",()=>{
  it.each(["curriculo.pdf","curriculo.docx"])("extrai e estrutura %s",async name=>{
    const resume = parseResume(await extractResume(await upload(name)));
    expect(resumeSchema.safeParse(resume).success).toBe(true);
    expect(resume).toMatchObject({name:"Ana Ribeiro",email:"ana.ribeiro@example.com",phone:"(11) 91234-5678",
      location:"São Paulo, Brasil",languages:["Inglês avançado"],certifications:["AWS Cloud Practitioner"],
      projects:["Painel de testes automatizados"]});
    expect(resume.technologies).toEqual(expect.arrayContaining(["React","TypeScript","PostgreSQL"]));
    expect(resume.previousRoles).toContain("Software Engineer | Estúdio de Teste | 2020-2025");
    expect(resume.skills).toEqual(["Testes automatizados","Trabalho em equipe"]);
    expect(resume.education[0]).toMatch(/Bacharelado/);
  });

  it("distingue PDF sem texto de arquivo corrompido",async()=>{
    await expect(extractResume(await upload("sem-texto.pdf"))).rejects.toMatchObject({code:"NO_TEXT"});
    await expect(extractResume(new File(["Isto não é PDF"],"curriculo.pdf"))).rejects.toMatchObject({code:"INVALID_FILE"});
    await expect(extractResume(new File(["PDF disfarçado"],"curriculo.docx"))).rejects.toMatchObject({code:"INVALID_FILE"});
  });

  it("descarta formatos e uploads excessivos",async()=>{
    await expect(extractResume(new File(["Formato não permitido"],"curriculo.txt"))).rejects.toMatchObject({status:415});
    await expect(extractResume(new File([new Uint8Array(maxUploadBytes+1)],"curriculo.pdf"))).rejects.toMatchObject({status:413});
  });

  it("entrega somente os campos estruturados na resposta do upload",async()=>{
    const data = new FormData();
    data.set("file",await upload("curriculo.docx"));
    const response = await POST(routeRequest(data));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Object.keys(await response.json())).toEqual(["resume"]);
  });

  it("rejeita upload ausente ou múltiplo",async()=>{
    expect((await POST(routeRequest(new FormData()))).status).toBe(400);
    const data = new FormData();
    data.append("file",await upload("curriculo.docx"));
    data.append("file",await upload("curriculo.pdf"));
    expect((await POST(routeRequest(data))).status).toBe(400);
  });

  it("limita o corpo multipart antes da extração",async()=>{
    const response = await POST(new Request("https://jobmatch.invalid/api/resume/parse",{
      method:"POST",headers:{"Content-Type":"multipart/form-data; boundary=test","Content-Length":String(6_000_000)},
    }));
    expect(response.status).toBe(413);
  });
});
