"use client";

import Link from "next/link";
import { ArrowRight, Banknote, BriefcaseBusiness, MapPin } from "lucide-react";
import type { MatchResult } from "@/lib/matching";
import { employmentNames, modeNames, seniorityNames, sourceNames, type Job } from "@/lib/schema";
import { formatSalary } from "@/lib/utils";
import { ApplyButton, PersonalizeButton } from "./job-actions";
import { useSession } from "./session";
import { Button } from "./ui/button";

export function CompanyMark({company}:{company:string}) {
  const initials = company.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase();
  return <div className="company-mark" aria-hidden="true" data-tone={company.codePointAt(0)! % 4}>{initials || "–"}</div>;
}

export function MatchIndicator({match}:{match:MatchResult | null}) {
  if (!match) return null;
  return <span className="match-indicator" data-level={!match.hasEvidence ? "unknown" : match.score>=65 ? "high" : match.score>=35 ? "medium" : "low"}>
    {match.hasEvidence ? <><span className="match-dot"/><strong>{match.score}%</strong> compatível</> : "Evidência insuficiente"}
  </span>;
}

export function JobCard({job,match}:{job:Job;match:MatchResult | null}) {
  const { selectJob, applications } = useSession();
  const href = `/vagas/${encodeURIComponent(job.id)}`;
  const pay = formatSalary(job.salaryMin,job.salaryMax,job.salaryCurrency,job.salaryInterval);
  return (
    <article className="job-card panel">
      <div className="job-card-head">
        <CompanyMark company={job.company}/>
        <div className="job-title"><p>{job.company} <span>·</span> {sourceNames[job.source]}</p>
          <h2><Link href={href} onClick={()=>selectJob(job)}>{job.title}</Link></h2>
        </div>
        <MatchIndicator match={match}/>
      </div>
      <div className="job-meta">
        {job.location && <span><MapPin size={15}/>{job.location}</span>}
        <span className={job.workMode==="unknown" ? "muted" : "mode-tag"}>{modeNames[job.workMode]}</span>
        {job.seniority && <span><BriefcaseBusiness size={15}/>{seniorityNames[job.seniority]}</span>}
        {job.employmentType && <span>{employmentNames[job.employmentType as keyof typeof employmentNames] ?? job.employmentType}</span>}
        {pay && <span><Banknote size={16}/>{pay}</span>}
      </div>
      {job.workMode==="remote" && <p className="remote-note">
        {job.geography.includesBrazil ? "A localização anunciada inclui o Brasil." : "Confirme se a vaga aceita candidaturas do Brasil."}
      </p>}
      {job.technologies.length>0 && <div className="chips job-chips">
        {job.technologies.slice(0,7).map(term=><span className="chip" key={term}>{term}</span>)}
        {job.technologies.length>7 && <span className="chip">+{job.technologies.length-7}</span>}
      </div>}
      <div className="job-actions">
        <Button variant="outline" asChild><Link href={href} onClick={()=>selectJob(job)}>Ver detalhes <ArrowRight size={16}/></Link></Button>
        <ApplyButton job={job}/>
        <PersonalizeButton job={job}/>
        {applications.includes(job.id) && <span className="applied-label">Candidatura registrada</span>}
      </div>
    </article>
  );
}
