"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, BriefcaseBusiness, ChevronDown, FileText, Link2, Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, requestJson } from "@/lib/client";
import { passesFilters, sortResults, type SortOption } from "@/lib/jobs/filters";
import type { SearchPage, SearchResponse } from "@/lib/jobs/providers";
import { compareResume } from "@/lib/matching";
import { emptyPreferences, sourceNames, type Preferences } from "@/lib/schema";
import { JobAnalysis } from "./job-analysis";
import { JobCard } from "./job-card";
import { countFilters, JobFilters } from "./job-filters";
import { useSession } from "./session";
import { Button } from "./ui/button";

const pageSize = 10;

async function loadCatalog(sources: Preferences["sources"], signal: AbortSignal): Promise<SearchResponse> {
  const params = new URLSearchParams(sources.map(source=>["source",source]));
  const first = await requestJson<SearchPage>(`/api/jobs/search?${params}`,{signal});
  const jobs = [...first.jobs];
  let cursor = first.next;
  while (cursor) {
    params.set("after",cursor);
    params.set("snapshot",first.snapshot);
    const page = await requestJson<SearchPage>(`/api/jobs/search?${params}`,{signal});
    jobs.push(...page.jobs);
    cursor = page.next;
  }
  return {jobs,boards:first.boards,partial:first.partial};
}

function useDebounced<T>(value:T, delay:number) {
  const [debounced,setDebounced] = useState(value);
  useEffect(()=>{
    const timer = window.setTimeout(()=>setDebounced(value),delay);
    return ()=>window.clearTimeout(timer);
  },[value,delay]);
  return debounced;
}

export function SearchShell() {
  const params = useSearchParams();
  const mode = params.get("modo") === "link" ? "link" : "catalog";
  const {resume} = useSession();
  return (
    <main id="conteudo" className="wrap workspace results-page">
      <header className="page-heading results-heading">
        <div><p className="page-kicker">BUSCA DE VAGAS</p><h1>Encontre sua próxima vaga.</h1>
          <p>Explore anúncios das empresas e compare os requisitos com seu perfil.</p></div>
        <Button variant="outline" asChild><Link href="/curriculo"><FileText size={17}/>{resume ? "Revisar currículo" : "Adicionar currículo"}</Link></Button>
      </header>
      <nav className="mode-nav" aria-label="Modo de busca">
        <Link href="/vagas" aria-current={mode==="catalog" ? "page" : undefined}><Search size={17}/> Explorar vagas</Link>
        <Link href="/vagas?modo=link" aria-current={mode==="link" ? "page" : undefined}><Link2 size={17}/> Analisar vaga por link</Link>
      </nav>
      {mode === "catalog" ? <CatalogSearch/> : <JobAnalysis/>}
    </main>
  );
}

export function SearchSkeleton() {
  return <div className="skeleton-list" role="status" aria-label="Carregando vagas">
    {Array.from({length:4},(_,index)=><div className="panel skeleton-card" key={index} aria-hidden="true"><i/><i/><i/></div>)}
  </div>;
}

function CatalogSearch() {
  const {resume,preferences,setPreferences} = useSession();
  const [version,setVersion] = useState(0);
  const [sort,setSort] = useState<SortOption>("match");
  const [visible,setVisible] = useState(pageSize);
  const filters = useDebounced(preferences,250);
  const sourceKeys = [...filters.sources].sort();
  const query = useQuery({
    queryKey:["jobs","catalog",...sourceKeys],
    queryFn:({signal})=>loadCatalog(sourceKeys,signal),
    retry:(attempt,error)=>attempt===0 && error instanceof ApiError && error.code==="CATALOG_CHANGED",
    retryDelay:0,
    placeholderData:keepPreviousData,
  });

  const results = useMemo(()=>{
    const jobs = query.data?.jobs ?? [];
    const eligible = jobs.filter(job=>passesFilters(job,filters)).map(job=>({
      job,match:resume ? compareResume(resume,job,filters) : null,
    })).filter(entry=>filters.minMatch===0 || Boolean(entry.match?.hasEvidence && entry.match.score>=filters.minMatch));
    return sortResults(eligible,sort,filters.currency,filters.salaryInterval);
  },[query.data,filters,resume,sort]);

  function update(next:Preferences) {
    setPreferences(next);
    setVisible(pageSize);
  }

  function clear() {
    update(emptyPreferences);
    setVersion(previous=>previous+1);
  }

  const failures = query.data?.boards.filter(board=>board.status!=="ok") ?? [];
  const allOffline = Boolean(query.data?.boards.length && query.data.boards.every(board=>board.status==="error"));

  return (
    <>
      <div className="search-bar">
        <Search size={21} aria-hidden="true"/>
        <input type="search" aria-label="Buscar por palavra-chave" placeholder="Busque por cargo, empresa ou palavra-chave" maxLength={300}
          value={preferences.keywords} onChange={e=>update({...preferences,keywords:e.target.value})}/>
        {preferences.keywords && <Button variant="ghost" size="icon" aria-label="Limpar pesquisa" onClick={()=>update({...preferences,keywords:""})}><X size={17}/></Button>}
      </div>
      <div className="results-layout">
        <JobFilters value={preferences} onChange={update} version={version} onClear={()=>setVersion(previous=>previous+1)}/>
        <section className="results-main" aria-label="Resultados">
          <div className="result-tools">
            <span role="status" aria-live="polite">{query.isPending ? "Consultando fontes…" : query.isError || allOffline ? "Busca indisponível" :
              <><strong>{results.length.toLocaleString("pt-BR")}</strong> {results.length===1 ? "vaga encontrada" : "vagas encontradas"}</>}</span>
            <label className="sort-label"><span>Ordenar por</span>
              <select aria-label="Ordenar por" value={sort} onChange={e=>{setSort(e.target.value as SortOption);setVisible(pageSize);}}>
                <option value="match">Compatibilidade</option><option value="recent">Mais recentes</option>
                <option value="salary">Maior salário</option><option value="company">Empresa</option>
              </select>
            </label>
          </div>
          {failures.length>0 && <div className="callout source-warning">
            <AlertCircle size={18}/>
            <div>
              <strong>{allOffline ? "Nenhuma fonte respondeu" : "Algumas fontes estão indisponíveis"}</strong>
              <p>{failures.map(board=>`${board.company} (${sourceNames[board.source]}${board.status==="stale" ? ", cache recente" : ""})`).join(" · ")}</p>
              <Button size="sm" variant="outline" disabled={query.isFetching} onClick={()=>query.refetch()}>{query.isFetching ? "Tentando…" : "Tentar novamente"}</Button>
            </div>
          </div>}
          {sort==="salary" && <p className="sort-note">Valores convertidos para escala anual quando o período está informado. Moedas são ordenadas separadamente.</p>}
          {!resume && !query.isPending && !allOffline && !query.isError && <div className="callout resume-reminder">
            <FileText size={18}/><p><Link href="/curriculo">Confirme seu currículo</Link> para ver a compatibilidade de cada vaga.</p>
          </div>}
          {query.isPending ? <SearchSkeleton/> : query.isError && !query.data ?
            <div className="empty-state panel"><AlertCircle size={30}/><h2>Não foi possível consultar as vagas</h2>
              <p>{query.error.message}</p><Button onClick={()=>query.refetch()}>Tentar novamente</Button></div>
            : results.length ? <>
              <div className="job-list" aria-busy={query.isFetching}>{results.slice(0,visible).map(({job,match})=><JobCard key={job.id} job={job} match={match}/>)}</div>
              {visible<results.length && <Button className="load-more" variant="outline" onClick={()=>setVisible(current=>current+pageSize)}>Carregar mais vagas <ChevronDown size={17}/></Button>}
            </> : <div className="empty-state panel">
              <BriefcaseBusiness size={32}/><h2>{allOffline ? "O catálogo está indisponível" : "Nenhuma vaga encontrada"}</h2>
              <p>{allOffline ? "Você pode analisar uma descrição enquanto as fontes estão indisponíveis." :
                filters.minMatch>0 && !resume ? "Confirme seu currículo para usar o filtro de compatibilidade." : "Experimente ampliar a busca ou analisar o anúncio por link."}</p>
              {!allOffline && (countFilters(filters)>0 || filters.keywords) ? <Button variant="outline" onClick={clear}>Limpar filtros</Button> :
                <Button variant="outline" asChild><Link href="/vagas?modo=link">Analisar vaga por link</Link></Button>}
            </div>}
        </section>
      </div>
    </>
  );
}
