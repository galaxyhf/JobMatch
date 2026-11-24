"use client";

import Link from "next/link";
import { ArrowUpRight, Check, FilePenLine } from "lucide-react";
import { toast } from "sonner";
import type { Job } from "@/lib/schema";
import { safeExternalUrl } from "@/lib/utils";
import { Button } from "./ui/button";
import { useSession } from "./session";

export function ApplyButton({job}:{job:Job}) {
  const {selectJob} = useSession();
  const url = job.applicationUrl && safeExternalUrl(job.applicationUrl);
  if (!url) return null;
  return <Button asChild>
    <a href={url.href} target="_blank" rel="noopener noreferrer" onClick={()=>selectJob(job)}>
      Candidatar-se <ArrowUpRight size={17}/>
    </a>
  </Button>;
}

export function PersonalizeButton({job}:{job:Job}) {
  const {selectJob} = useSession();
  return <Button variant="ghost" asChild>
    <Link href={`/curriculo/${encodeURIComponent(job.id)}`} onClick={()=>selectJob(job)}><FilePenLine size={16}/> Personalizar currículo</Link>
  </Button>;
}

export function MarkApplication({job}:{job:Job}) {
  const {applications,toggleApplication} = useSession();
  const applied = applications.includes(job.id);
  return <Button variant="outline" aria-pressed={applied} onClick={()=> {
    const persisted = toggleApplication(job.id);
    if (!persisted) toast.info("Registro atualizado só nesta sessão.");
    else toast.success(applied ? "Registro de candidatura removido." : "Candidatura registrada neste navegador.");
  }}><Check size={16}/>{applied ? "Candidatura registrada · desfazer" : "Marcar como candidatura realizada"}</Button>;
}
