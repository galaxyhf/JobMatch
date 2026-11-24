"use client";

import { useMutation } from "@tanstack/react-query";
import { FileUp, LoaderCircle, ShieldCheck, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { requestJson } from "@/lib/client";
import type { ParsedResume } from "@/lib/schema";
import { useSession } from "./session";
import { Button } from "./ui/button";

export function ResumeUpload({onComplete}:{onComplete?:()=>void}) {
  const router = useRouter();
  const { setDraft } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [dragging,setDragging] = useState(false);
  const [error,setError] = useState("");
  const id = useId();
  const mutation = useMutation({
    gcTime:0,
    mutationFn:async (file:File) => {
      const form = new FormData();
      form.set("file",file);
      return requestJson<{resume:ParsedResume}>("/api/resume/parse",{method:"POST",body:form});
    },
    onSuccess:({resume},file) => {
      setDraft({resume,filename:file.name});
      onComplete?.();
      toast.success("Currículo lido. Revise os dados extraídos.");
      router.push("/curriculo");
    },
    onError:error => setError(error.message),
  });

  function submit(file?: File) {
    if (!file || mutation.isPending) return;
    setError("");
    if (!/\.(pdf|docx)$/i.test(file.name)) {setError("Escolha um arquivo PDF ou DOCX.");return;}
    if (file.size > 4*1024*1024) {setError("Envie um arquivo de até 4 MB.");return;}
    mutation.mutate(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 1) {setError("Envie apenas um currículo por vez.");return;}
    submit(event.dataTransfer.files[0]);
  }

  return (
    <div className="upload-card" id="enviar">
      <div className="upload-header"><FileText size={18}/><h2>Seu currículo</h2></div>
      <div className="upload-zone" data-dragging={dragging} aria-busy={mutation.isPending}
        onDragOver={event=>{event.preventDefault();setDragging(true);}}
        onDragLeave={event=>{if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);}}
        onDrop={onDrop}>
        <span className="upload-symbol">{mutation.isPending ? <LoaderCircle className="spinner" size={29}/> : <FileUp size={29} strokeWidth={1.6}/>}</span>
        <strong>{mutation.isPending ? "Lendo seu currículo…" : "Arraste seu currículo aqui"}</strong>
        <p id={id}>PDF ou DOCX · até 4 MB</p>
        <input ref={input} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-label="Arquivo do currículo" tabIndex={-1} className="sr-only"
          onChange={event=>{submit(event.currentTarget.files?.[0]);event.currentTarget.value="";}}/>
        <Button onClick={()=>input.current?.click()} disabled={mutation.isPending} aria-describedby={id}>
          {mutation.isPending ? "Processando" : "Selecionar arquivo"}
        </Button>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <p className="upload-privacy"><ShieldCheck size={16}/> Seus dados ficam na sessão.</p>
    </div>
  );
}
