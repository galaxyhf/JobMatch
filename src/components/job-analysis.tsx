"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, ClipboardPaste, Info, Link2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ApiError, requestJson } from "@/lib/client";
import { isLinkedInJobUrl } from "@/lib/jobs/linkedin";
import { analysisSchema, type Job } from "@/lib/schema";
import { useSession } from "./session";
import { Button } from "./ui/button";

interface Form {
  url: string;
  description: string;
  title: string;
  company: string;
}

export function JobAnalysis() {
  const {selectJob,resume} = useSession();
  const router = useRouter();
  const {control,register,handleSubmit,setError,formState:{errors},clearErrors} = useForm<Form>({defaultValues:{url:""}});
  const [manual,setManual] = useState(false);
  const linkedIn = isLinkedInJobUrl(useWatch({control,name:"url"}));
  const showDescription = manual || linkedIn;
  const mutation = useMutation({
    gcTime:0,
    mutationFn: (data:unknown) => requestJson<{job:Job}>("/api/jobs/analyze",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),
    }),
    onSuccess:({job}) => {
      selectJob(job);
      router.push(`/vagas/${encodeURIComponent(job.id)}`);
    },
    onError:error=>{if (error instanceof ApiError && error.code === "MANUAL_REQUIRED") setManual(true);},
  });
  const submit = handleSubmit(values=>{
    mutation.reset();
    clearErrors();
    const valid = analysisSchema.safeParse(Object.fromEntries(Object.entries(values).filter(([,value])=>value.trim())));
    if (!valid.success) {
      const issue = valid.error.issues[0];
      const field = issue.path[0] as keyof Form | undefined;
      setError(field ?? (manual ? "description" : "url"),{message:issue.message},{shouldFocus:true});
      return;
    }
    if (linkedIn && !valid.data.description) {
      setError("description",{message:"Cole a descrição da vaga do LinkedIn para continuar."},{shouldFocus:true});
      return;
    }
    mutation.mutate(valid.data);
  });

  return (
    <section className="panel analysis-panel">
      <div className="analysis-symbol"><Link2 size={25}/></div>
      <h2>Analisar vaga por link</h2>
      <p className="muted">Use um link de Greenhouse, Lever ou Ashby. Para vagas do LinkedIn e de outros portais, cole a descrição do anúncio.</p>
      {!resume && <div className="callout compact"><Info size={17}/><p>Com um currículo confirmado, você também verá a compatibilidade.</p></div>}
      <form className="analysis-form" onSubmit={submit} noValidate>
        <label className="field">Link da vaga {manual && !linkedIn && <span className="muted">(opcional)</span>}
          <input type="url" placeholder="https://…" maxLength={2048} {...register("url")} aria-invalid={Boolean(errors.url)}/>
          {errors.url && <span className="field-error" role="alert">{errors.url.message}</span>}
        </label>
        {mutation.error && <p role="alert" className="field-error">{mutation.error.message}</p>}
        {showDescription && <>
          <div className="form-grid">
            <label className="field">Cargo <span className="muted">(opcional)</span><input maxLength={300} {...register("title")}/></label>
            <label className="field">Empresa <span className="muted">(opcional)</span><input maxLength={300} {...register("company")}/></label>
          </div>
          <label className="field">Descrição da vaga
            <textarea rows={9} maxLength={55000} placeholder="Cole os detalhes publicados no anúncio…" {...register("description")}
              aria-invalid={Boolean(errors.description)}/>
            {errors.description && <span className="field-error" role="alert">{errors.description.message}</span>}
          </label>
        </>}
        <div className="inline-actions">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <><LoaderCircle className="spinner" size={17}/> Analisando…</> : <>Analisar vaga <ArrowRight size={17}/></>}
          </Button>
          {!showDescription && <Button variant="outline" onClick={()=>{setManual(true);mutation.reset();clearErrors();}}><ClipboardPaste size={17}/> Colar descrição</Button>}
        </div>
      </form>
    </section>
  );
}
