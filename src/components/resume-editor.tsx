"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, Check, FileText, Info, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { emptyResume, resumeSchema, type ParsedResume } from "@/lib/schema";
import { ResumeUpload } from "./resume-upload";
import { Button } from "./ui/button";
import { useSession } from "./session";

const groups = [
  { title:"Perfil profissional", fields:[
    {key:"summary", label:"Resumo profissional", rows:4},
    {key:"desiredRoles",label:"Cargos desejados",placeholder:"Ex.: Engenheira de software",rows:2},
    {key:"previousRoles",label:"Cargos anteriores",rows:3},
    {key:"experience",label:"Experiências",placeholder:"Empresa, cargo, período e atividades",rows:4},
  ]},
  { title:"Habilidades e formação", fields:[
    {key:"technologies",label:"Tecnologias",rows:3},
    {key:"skills",label:"Habilidades",rows:3},
    {key:"languages",label:"Idiomas",placeholder:"Ex.: Inglês avançado",rows:3},
    {key:"education",label:"Formação acadêmica",rows:3},
    {key:"certifications",label:"Certificações",rows:3},
    {key:"projects",label:"Projetos",rows:3},
  ]},
] as const;
const contacts = [
  ["name","Nome","text"],["email","E-mail","email"],["phone","Telefone","tel"],["location","Localização","text"],
] as const;

type LinesField = typeof groups[number]["fields"][number]["key"];
type Form = Omit<ParsedResume,LinesField> & Record<LinesField,string>;

function defaults(resume: ParsedResume): Form {
  return {...resume,desiredRoles:resume.desiredRoles.join("\n"),previousRoles:resume.previousRoles.join("\n"),
    experience:resume.experience.join("\n"),technologies:resume.technologies.join("\n"),skills:resume.skills.join("\n"),
    languages:resume.languages.join("\n"),education:resume.education.join("\n"),certifications:resume.certifications.join("\n"),
    projects:resume.projects.join("\n")};
}

export function ResumeEditor() {
  const {draft,resume,setDraft,setResume} = useSession();
  const [startManually,setStartManually] = useState(false);
  const [replace,setReplace] = useState(false);
  const editing = (draft || resume || startManually) && !replace;
  const first = draft?.resume ?? resume ?? emptyResume;
  return (
    <main className={`wrap workspace ${editing ? "editor-shell" : "narrow"}`} id="conteudo">
      <header className="page-heading">
        <div><p className="page-kicker">SEU PERFIL</p><h1>{editing ? "Revise seu currículo" : "Meu currículo"}</h1>
          <p>{editing ? "Corrija os campos e complete o perfil antes de calcular a compatibilidade." : "Envie um currículo ou preencha seu perfil para comparar vagas."}</p>
        </div>
        {editing && <Button variant="outline" onClick={()=>setReplace(true)}><Upload size={16}/> Enviar outro</Button>}
      </header>
      {editing ? <ResumeForm key={draft?.filename ?? "manual"} initial={first} filename={draft?.filename}
        onClear={()=>{setDraft(null);setResume(null);setStartManually(false);toast.success("Currículo removido desta sessão.");}}/>
        : <div className="upload-page">
          <ResumeUpload onComplete={()=>setReplace(false)}/>
          {replace ? <Button variant="ghost" onClick={()=>setReplace(false)}>Voltar à revisão</Button>
            : <Button variant="ghost" onClick={()=>setStartManually(true)}>Preencher manualmente <ArrowRight size={16}/></Button>}
        </div>}
    </main>
  );
}

function ResumeForm({initial,filename,onClear}:{initial:ParsedResume;filename?:string;onClear:()=>void}) {
  const {setResume,setDraft} = useSession();
  const router = useRouter();
  const [confirmClear,setConfirmClear] = useState(false);
  const {register,handleSubmit,setError,formState:{errors}} = useForm<Form>({defaultValues:defaults(initial)});

  const confirm = handleSubmit(values => {
    const parsed = resumeSchema.safeParse(Object.fromEntries(Object.entries(values).map(([key,value])=>
      [key,["name","email","phone","location","summary"].includes(key) ? value.trim() : value.split("\n").map(line=>line.trim()).filter(Boolean)],
    )));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Form;
        setError(field,{message:field==="email" ? "Informe um e-mail válido." : "Reduza o tamanho ou a quantidade de itens neste campo."},{shouldFocus:true});
      }
      return;
    }
    const profileFields = [parsed.data.summary,...parsed.data.experience,...parsed.data.skills,...parsed.data.technologies,
      ...parsed.data.desiredRoles,...parsed.data.previousRoles,...parsed.data.languages,...parsed.data.education];
    if (!profileFields.some(Boolean)) {
      setError("summary",{message:"Adicione um resumo, um cargo ou outra informação profissional."},{shouldFocus:true});
      return;
    }
    setResume(parsed.data);
    setDraft(null);
    toast.success("Currículo confirmado para esta sessão.");
    router.push("/vagas");
  });

  return (
    <form onSubmit={confirm} className="editor-form" noValidate>
      <div className="callout">
        {filename ? <FileText size={19}/> : <Info size={19}/>}
        <div><strong>{filename ?? "Dados da sessão"}</strong>
          <p>{filename ? "A leitura automática pode omitir campos. Confira os dados antes de continuar." : "Use as informações que deseja considerar na comparação."}</p></div>
      </div>
      <section className="panel form-panel" aria-labelledby="contato">
        <h2 id="contato">Dados de contato</h2>
        <div className="form-grid">
          {contacts.map(([key,label,type])=>
            <label className="field" key={key}>{label}
              <input type={type} maxLength={key==="email" ? 254 : 300} aria-invalid={Boolean(errors[key])} {...register(key)}/>
              {errors[key] && <span className="field-error" role="alert">{errors[key].message}</span>}
            </label>)}
        </div>
      </section>
      {groups.map(group=><section className="panel form-panel" key={group.title}>
        <h2>{group.title}</h2><p className="muted">Nos campos de lista, use uma linha por item.</p>
        <div className="form-grid">
          {group.fields.map(field=>{
            const {key,label,rows} = field;
            return <label className={`field ${key==="summary" || key==="experience" ? "full-field" : ""}`} key={key}>{label}
              <textarea rows={rows} placeholder={"placeholder" in field ? field.placeholder : undefined}
                maxLength={key==="summary" ? 6000 : 50_000} aria-invalid={Boolean(errors[key])} {...register(key)}/>
              {errors[key] && <span className="field-error" role="alert">{errors[key].message}</span>}
            </label>;
          })}
        </div>
      </section>)}
      <div className="form-actions">
        {confirmClear ? <div className="inline-actions">
          <span>Remover os dados desta sessão?</span>
          <Button variant="outline" onClick={onClear}>Remover</Button>
          <Button variant="ghost" size="icon" aria-label="Manter currículo" onClick={()=>setConfirmClear(false)}><X size={18}/></Button>
        </div> : <Button variant="ghost" className="danger-text" onClick={()=>setConfirmClear(true)}>Remover currículo</Button>}
        <Button type="submit"><Check size={18}/> Confirmar e buscar vagas <ArrowRight size={17}/></Button>
      </div>
    </form>
  );
}
