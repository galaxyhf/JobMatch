import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fixtureJob } from "../fixtures/jobs";

const fixture = (name:string) => path.join(process.cwd(),"src/tests/fixtures",name);

async function mockCatalog(page:Page) {
  const other = {...fixtureJob,id:"greenhouse:global:empresa-teste:90211",title:"Analista de suporte",company:"Outro quadro",publishedAt:new Date(Date.now()-3600_000).toISOString(),
    applicationUrl:"https://example.com/vagas/90211",required:[],requirements:[],technologies:["Excel"]};
  await page.route("**/api/jobs/search?*",async route=>{
    const url = new URL(route.request().url());
    const next = url.searchParams.get("after");
    await route.fulfill({json:{
      jobs:next ? [other] : [fixtureJob],
      next:next ? null : fixtureJob.id,
      snapshot:"fixture",
      boards:[{source:"greenhouse",company:"Empresa de Teste",status:"ok",count:2},
        {source:"lever",company:"Quadro temporariamente fora do ar",status:"error",count:0}],
      partial:true,
    }});
  });
  await page.route("**/api/jobs/greenhouse*",route=>route.fulfill({json:{job:fixtureJob}}));
}

test("extrai PDF real, confirma alterações, filtra vagas e registra candidatura após abrir a fonte",async ({page,context})=>{
  await mockCatalog(page);
  await context.route("https://job-boards.greenhouse.io/**",route=>route.fulfill({body:"Página externa de teste"}));
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Encontre vagas que combinam com você.");
  await page.getByLabel("Arquivo do currículo").setInputFiles(fixture("curriculo.pdf"));
  await expect(page.getByRole("heading",{name:"Revise seu currículo"})).toBeVisible();
  await expect(page.getByLabel("Nome",{exact:true})).toHaveValue("Ana Ribeiro");
  await page.getByLabel("Cargos desejados").fill("Engenheira de software sênior");
  await page.getByLabel("Habilidades",{exact:true}).fill("Testes automatizados\nComunicação");
  await page.getByRole("button",{name:"Confirmar e buscar vagas"}).click();
  await expect(page.getByText("2 vagas encontradas")).toBeVisible();
  await expect(page.getByText("Algumas fontes estão indisponíveis")).toBeVisible();
  await page.getByRole("searchbox").fill("Engenharia Software");
  await expect(page.getByText("1 vaga encontrada")).toBeVisible();
  await expect(page.getByText(/\d+% compatível/)).toBeVisible();
  await page.getByRole("link",{name:"Ver detalhes"}).click();
  await expect(page.getByRole("heading",{name:"Engenheira de Software Sênior",level:1})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Requisitos obrigatórios"})).toBeVisible();
  const mark = page.getByRole("button",{name:"Marcar como candidatura realizada"});
  await expect(mark).toHaveAttribute("aria-pressed","false");
  const [popup] = await Promise.all([page.waitForEvent("popup"),page.getByRole("link",{name:"Candidatar-se",exact:true}).click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(fixtureJob.applicationUrl);
  await expect(mark).toHaveAttribute("aria-pressed","false");
  await mark.click();
  await expect(page.getByRole("button",{name:/Candidatura registrada/})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("link",{name:"Personalizar currículo"}).click();
  await expect(page.getByText("Personalização com IA disponível em breve.")).toBeVisible();
  await expect(page.getByText("Ana Ribeiro")).toBeVisible();
  await expect(page.getByRole("button",{name:"Gerar currículo personalizado"})).toBeDisabled();
  const stored = await page.evaluate(()=>JSON.stringify(localStorage));
  expect(stored).not.toContain("Ana Ribeiro");
  expect(stored).not.toContain("ana.ribeiro");
  expect(stored).toContain("jobmatch-candidaturas-v1");
});

test("trata PDF sem texto e extrai um DOCX em nova tentativa",async ({page})=>{
  await page.goto("/");
  await page.getByLabel("Arquivo do currículo").setInputFiles(fixture("sem-texto.pdf"));
  await expect(page.getByRole("alert").filter({hasText:"texto selecionável"})).toBeVisible();
  await page.getByLabel("Arquivo do currículo").setInputFiles(fixture("curriculo.docx"));
  await expect(page.getByLabel("Nome",{exact:true})).toHaveValue("Ana Ribeiro");
});

test("mostra vagas do LinkedIn na busca principal e abre o detalhe no JobMatch",async ({page})=>{
  const linkedin = {...fixtureJob,id:"linkedin:123",externalId:"123",source:"linkedin",title:"Analista de Dados",
    company:"Empresa LinkedIn",sourceUrl:"https://br.linkedin.com/jobs/view/analista-123",
    applicationUrl:"https://br.linkedin.com/jobs/view/analista-123"};
  await page.route("**/api/jobs/search?*",async route=>{
    await route.fulfill({json:{
      jobs:[fixtureJob,{...linkedin,description:""}],
      next:null,snapshot:"fixture",boards:[],partial:false,
    }});
  });
  await page.route("**/api/jobs/linkedin*",route=>route.fulfill({json:{job:linkedin}}));
  await page.goto("/vagas");
  const search = page.getByRole("search",{name:"Busca de vagas"});
  await expect(search.getByLabel("Onde buscar")).toHaveCount(0);
  const list = page.getByRole("region",{name:"Resultados"});
  await expect(list.getByRole("link",{name:fixtureJob.title})).toBeVisible();
  await expect(list.getByRole("link",{name:linkedin.title})).toBeVisible();
  const request = page.waitForRequest(request=>new URL(request.url()).searchParams.get("keywords")==="Analista de Dados");
  await search.getByRole("searchbox").fill("Analista de Dados");
  await search.getByRole("button",{name:"Buscar",exact:true}).click();
  await request;
  await expect(list.getByRole("link",{name:fixtureJob.title})).toHaveCount(0);
  await list.getByRole("link",{name:linkedin.title}).click();
  await expect(page.getByRole("heading",{name:linkedin.title,level:1})).toBeVisible();
  await expect(page.getByText(linkedin.description,{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Candidatar-se",exact:true})).toHaveAttribute("href",linkedin.applicationUrl);
});

test("filtra o catálogo pelo tempo de publicação na mesma barra de busca",async ({page})=>{
  await mockCatalog(page);
  await page.goto("/vagas");
  await expect(page.getByText("2 vagas encontradas")).toBeVisible();
  const period = page.getByLabel("Tempo de publicação");
  await period.selectOption("day");
  await expect(page.getByText("1 vaga encontrada")).toBeVisible();
  await expect(page.getByRole("link",{name:"Analista de suporte"})).toBeVisible();
  await expect(page.getByRole("link",{name:fixtureJob.title})).toHaveCount(0);
  await period.selectOption("");
  await expect(page.getByText("2 vagas encontradas")).toBeVisible();
});

test("mostra o campo de descrição ao colar o link de uma vaga do LinkedIn",async ({page})=>{
  await page.goto("/vagas?modo=link");
  await page.getByLabel("Link da vaga").fill("https://www.linkedin.com/jobs/view/123");
  await expect(page.getByLabel("Descrição da vaga")).toBeVisible();
  await page.getByRole("button",{name:"Analisar vaga",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Cole a descrição da vaga do LinkedIn"})).toBeVisible();
  await page.getByLabel("Cargo").fill("Analista de dados");
  await page.getByLabel("Empresa").fill("Empresa de Teste");
  await page.getByLabel("Descrição da vaga").fill("Responsabilidades:\nPreparar relatórios operacionais.\nRequisitos:\nExperiência com SQL e Python.");
  await page.getByRole("button",{name:"Analisar vaga",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Analista de dados",level:1})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Responsabilidades"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Candidatar-se",exact:true})).toHaveAttribute("href","https://www.linkedin.com/jobs/view/123");
});

test("abre filtros móveis, salva preferências e alterna o tema",async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockCatalog(page);
  await page.goto("/vagas");
  await page.getByRole("button",{name:"Filtros",exact:true}).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Países").selectOption("BR");
  await drawer.getByLabel("Países").selectOption("PT");
  await drawer.getByLabel("Remoto",{exact:true}).check();
  await drawer.getByLabel("Salvar preferências").check();
  await drawer.getByRole("button",{name:"Ver resultados"}).click();
  await expect(drawer).toBeHidden();
  await page.reload();
  await page.getByRole("button",{name:/^Filtros/}).click();
  await expect(drawer.getByLabel("Remoto",{exact:true})).toBeChecked();
  await expect(drawer.getByRole("button",{name:"Remover Brasil"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await page.getByRole("button",{name:"Alternar tema"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

test("abre um anúncio real usando o catálogo oficial",async ({page})=>{
  test.skip(process.env.JOBMATCH_TEST_LIVE!=="1","Requer rede e provedores públicos disponíveis.");
  await page.goto("/vagas");
  await expect(page.locator(".job-list article").first()).toBeVisible({timeout:35_000});
  const card = page.locator(".job-list article").first();
  const url = await card.getByRole("link",{name:"Candidatar-se",exact:true}).getAttribute("href");
  expect(url).toMatch(/^https:\/\//);
  await card.getByRole("link",{name:"Ver detalhes"}).click();
  await expect(page.getByRole("heading",{name:"Descrição da vaga"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Candidatar-se",exact:true})).toHaveAttribute("href",url!);
});
