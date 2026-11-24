"use client";

import Link from "next/link";
import { ArrowLeft, FileText, LockKeyhole, Sparkles } from "lucide-react";
import { useId } from "react";
import { sourceNames, type ParsedResume } from "@/lib/schema";
import { Chips, JobAvailability, JobBack, useJob } from "./job-detail";
import { useSession } from "./session";
import { Button } from "./ui/button";

const fields = [
  ["name","Nome"],["email","E-mail"],["phone","Telefone"],["location","Localização"],["summary","Resumo profissional"],
  ["experience","Experiências"],["previousRoles","Cargos anteriores"],["desiredRoles","Cargos desejados"],["education","Formação"],
  ["technologies","Tecnologias"],["skills","Habilidades"],["languages","Idiomas"],["certifications","Certificações"],["projects","Projetos"],
] as const satisfies readonly (readonly [keyof ParsedResume,string])[];

export function Personalization({id}:{id:string}) {
  const state = useJob(id);
  const {resume} = useSession();
  const message = useId();
  const job = state.job;
  if (!job) return <main id="conteudo" className="workspace wrap narrow"><JobBack/><JobAvailability {...state}/></main>;

  return (
    <main id="conteudo" className="workspace wrap narrow personalization">
      <Link className="back-link" href={`/vagas/${encodeURIComponent(job.id)}`}><ArrowLeft size={17}/> Voltar à vaga</Link>
      <header className="page-heading">
        <div><p className="page-kicker">CURRÍCULO PARA UMA VAGA</p><h1>Personalizar currículo</h1><p>{job.title} · {job.company}</p></div>
      </header>
      <div className="callout ai-status" id={message}><LockKeyhole size={19}/><strong>Personalização com IA disponível em breve.</strong></div>
      <section className="panel form-panel">
        <h2>Informações da vaga</h2><p>{job.company} · {sourceNames[job.source]}</p>
        {job.location && <p className="muted">{job.location}</p>}
        <h3>Tecnologias relevantes</h3>
        {job.technologies.length ? <Chips values={job.technologies}/> : <p className="muted">Nenhuma tecnologia identificada.</p>}
        <h3>Requisitos identificados</h3>
        {job.requirements.length ? <ul className="bullet-list">{job.requirements.map(line=><li key={line}>{line}</li>)}</ul>
          : <p className="muted">Nenhum requisito identificado.</p>}
      </section>
      <section className="panel form-panel">
        <h2>Currículo original</h2>
        {resume ? <dl className="original-resume">{fields.map(([key,label])=>{
          const info = resume[key];
          if (!info.length) return null;
          return <div key={key}><dt>{label}</dt><dd>{Array.isArray(info) ? info.join("\n") : info}</dd></div>;
        })}</dl> : <><p>Confirme seu currículo para visualizar os dados que serão usados.</p>
          <Button variant="outline" asChild><Link href="/curriculo"><FileText size={16}/> Adicionar currículo</Link></Button></>}
      </section>
      <section className="panel form-panel">
        <h2>Preferências do documento</h2>
        <div className="form-grid">
          <label className="field">Idioma desejado<select defaultValue="pt-BR"><option value="pt-BR">Português (Brasil)</option><option value="en">Inglês</option><option value="es">Espanhol</option></select></label>
          <label className="field">Formato desejado<select defaultValue="pdf"><option value="pdf">PDF</option><option value="docx">DOCX</option></select></label>
          <label className="field full-field">Estilo do currículo<select defaultValue="clean"><option value="clean">Simples</option><option value="classic">Clássico</option><option value="compact">Compacto</option></select></label>
        </div>
        <Button disabled aria-describedby={message}><Sparkles size={17}/> Gerar currículo personalizado</Button>
      </section>
    </main>
  );
}
