"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Banknote, CalendarDays, Copy, ExternalLink, FileText, Globe2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { requestJson } from "@/lib/client";
import { compareResume } from "@/lib/matching";
import { employmentNames, languageNames, modeNames, seniorityNames, sourceNames, type Job } from "@/lib/schema";
import { countryName } from "@/lib/terms";
import { formatSalary, safeExternalUrl } from "@/lib/utils";
import { ApplyButton, MarkApplication, PersonalizeButton } from "./job-actions";
import { CompanyMark, MatchIndicator } from "./job-card";
import { useSession } from "./session";
import { Button } from "./ui/button";

const catalogId = /^(?:(greenhouse|lever|ashby):(global|eu):[a-z0-9_-]+:[a-z0-9-]+|linkedin:\d{1,18})$/;

export function useJob(id:string) {
  const {selected} = useSession();
  const existing = selected[id];
  const query = useQuery({
    queryKey:["jobs","detail",id],
    enabled:catalogId.test(id) && (!existing || (existing.source==="greenhouse" && !existing.salaryCurrency) || (existing.source==="linkedin" && !existing.description)),
    queryFn:({signal})=>requestJson<{job:Job}>(`/api/jobs/${encodeURIComponent(id)}`,{signal}),
  });
  return {job:query.data?.job ?? existing, pending:query.isLoading, error:query.error, retry:query.refetch};
}

export function Chips({values}:{values:string[]}) {
  return <div className="chips">{values.map(value=><span className="chip" key={value}>{value}</span>)}</div>;
}

function DetailList({title,items}:{title:string;items:string[]}) {
  if (!items.length) return null;
  return <section className="detail-section"><h2>{title}</h2><ul className="bullet-list">{items.map(item=><li key={item}>{item}</li>)}</ul></section>;
}

export function JobBack({label="Voltar à busca"}:{label?:string}) {
  return <Link className="back-link" href="/vagas"><ArrowLeft size={17}/>{label}</Link>;
}

export function JobAvailability({pending,error,retry}:{pending:boolean;error:Error|null;retry:()=>unknown}) {
  if (pending) return <div className="panel skeleton-card" role="status" aria-label="Carregando vaga"><i/><i/><i/></div>;
  return <div className="panel empty-state"><AlertCircle size={31}/><h1>Vaga indisponível</h1>
    <p>{error?.message ?? "Abra a vaga novamente a partir da busca ou refaça a análise por link."}</p>
    {error && <Button variant="outline" onClick={()=>retry()}>Tentar novamente</Button>}</div>;
}

export function JobDetail({id}:{id:string}) {
  const state = useJob(id);
  const {resume,preferences} = useSession();
  const job = state.job;

  if (!job) return <main id="conteudo" className="workspace wrap narrow"><JobBack/><JobAvailability {...state}/></main>;
  const score = resume ? compareResume(resume,job,preferences) : null;
  const salary = formatSalary(job.salaryMin,job.salaryMax,job.salaryCurrency,job.salaryInterval);
  const original = job.sourceUrl ? safeExternalUrl(job.sourceUrl) : null;
  const locale = (job.location || (job.country ? countryName(job.country) : null)) ?? "Localização não informada";

  async function copy() {
    if (!original) return;
    try {
      await navigator.clipboard.writeText(original.href);
      toast.success("Link original copiado.");
    } catch {
      toast.error("O navegador não permitiu copiar o link.");
    }
  }

  return (
    <main className="workspace wrap detail-page" id="conteudo">
      <JobBack/>
      <header className="detail-header panel">
        <div className="detail-title"><CompanyMark company={job.company}/><div><p>{job.company} <span>·</span> {sourceNames[job.source]}</p><h1>{job.title}</h1></div></div>
        <div className="job-meta">
          <span><MapPin size={16}/>{locale}</span>
          <span className="mode-tag">{modeNames[job.workMode]}</span>
          {job.seniority && <span>{seniorityNames[job.seniority]}</span>}
          {job.employmentType && <span>{employmentNames[job.employmentType as keyof typeof employmentNames] ?? job.employmentType}</span>}
          {job.publishedAt && <span><CalendarDays size={16}/><time dateTime={job.publishedAt}>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(job.publishedAt))}</time></span>}
        </div>
        <div className="inline-actions"><ApplyButton job={job}/><PersonalizeButton job={job}/>
          {original && <Button variant="outline" onClick={copy}><Copy size={16}/> Copiar link</Button>}
        </div>
      </header>
      <div className="detail-layout">
        <div className="panel detail-document">
          <section className="detail-section"><h2>Descrição da vaga</h2>
            {job.description ? <div className="job-description">{job.description}</div> : <p className="muted">Descrição não fornecida pela fonte.</p>}
          </section>
          <DetailList title="Responsabilidades" items={job.responsibilities}/>
          <DetailList title="Requisitos obrigatórios" items={job.required}/>
          <DetailList title="Requisitos desejáveis" items={job.preferred}/>
          <DetailList title="Benefícios" items={job.benefits}/>
          {job.technologies.length>0 && <section className="detail-section"><h2>Tecnologias citadas</h2><Chips values={job.technologies}/></section>}
        </div>
        <aside className="detail-side">
          <section className="panel detail-side-card">
            <h2>Informações da vaga</h2>
            <div className="info-row"><Banknote size={18}/><div><strong>Remuneração</strong><p>{salary ?? "Não informada"}</p></div></div>
            {job.languages.length>0 && <div className="info-row"><Globe2 size={18}/><div><strong>Idiomas identificados</strong>
              <p>{job.languages.map(code=>languageNames[code as keyof typeof languageNames] ?? code).join(", ")}</p></div></div>}
            {job.workMode==="remote" && <div className="info-row"><Globe2 size={18}/><div><strong>Elegibilidade geográfica</strong>
              <p>{job.geography.excludesBrazil ? "O anúncio indica uma restrição para o Brasil." : job.geography.status==="worldwide" ? "O anúncio indica alcance mundial." :
                job.geography.includesBrazil ? "A localização anunciada inclui o Brasil." : "Não há confirmação de que a empresa aceita candidatos no Brasil."}</p>
              {job.geography.evidence.length>0 && <details><summary>Ver trechos do anúncio</summary><ul className="bullet-list">{job.geography.evidence.map(line=><li key={line}>{line}</li>)}</ul></details>}
            </div></div>}
            {original && <a className="text-action" href={original.href} target="_blank" rel="noopener noreferrer">Abrir anúncio original <ExternalLink size={15}/></a>}
            {job.applicationUrl && <MarkApplication job={job}/>}
          </section>
          <section className="panel detail-side-card match-card">
            <h2>Compatibilidade</h2>
            {score ? <>
              <MatchIndicator match={score}/>
              {score.hasEvidence && <progress className="match-progress" max={100} value={score.score} aria-label="Compatibilidade estimada"/>}
              <p className="muted">Estimativa heurística baseada no currículo confirmado e nos dados disponíveis da vaga.</p>
              <h3>Habilidades correspondentes</h3>
              {score.matchingSkills.length ? <Chips values={score.matchingSkills}/> : <p className="muted">Nenhuma correspondência identificada.</p>}
              <h3>Habilidades não identificadas no currículo</h3>
              {score.missingSkills.length ? <Chips values={score.missingSkills}/> : <p className="muted">Nenhuma habilidade ausente identificada.</p>}
              <DetailList title="Requisitos com evidência no currículo" items={score.requiredMet}/>
              <DetailList title="Requisitos não identificados no currículo" items={score.requiredMissing}/>
              {score.breakdown.length>0 && <details><summary>Entenda a pontuação</summary><ul className="bullet-list">
                {score.breakdown.map(item=><li key={item.criterion}>{item.reason}</li>)}
                {score.penalty>0 && <li>Requisitos obrigatórios sem evidência reduziram a pontuação em {Math.round(score.penalty)} pontos.</li>}
              </ul></details>}
              <DetailList title="Antes de se candidatar" items={score.recommendations}/>
            </> : <><p className="muted">Adicione um currículo para ver a comparação com os requisitos.</p>
              <Button variant="outline" asChild><Link href="/curriculo"><FileText size={16}/> Adicionar currículo</Link></Button></>}
          </section>
        </aside>
      </div>
    </main>
  );
}
