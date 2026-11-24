import Link from "next/link";
import { ArrowRight, ChartNoAxesColumnIncreasing, FileCheck2, Globe2, Link2, Search, ShieldCheck } from "lucide-react";
import { ResumeUpload } from "@/components/resume-upload";
import { Button } from "@/components/ui/button";

const steps = [
  {icon:FileCheck2,title:"Revise seu currículo", description:"Envie um PDF ou DOCX. Confira a leitura e ajuste cargos, experiências e habilidades."},
  {icon:Search,title:"Encontre oportunidades", description:"Filtre vagas publicadas pelas empresas por cargo, país, modalidade, tecnologia e outros critérios."},
  {icon:ChartNoAxesColumnIncreasing,title:"Compare e decida", description:"Veja quais requisitos aparecem no seu perfil e siga para a candidatura na página original."},
];

export default function HomePage() {
  return (
    <main id="conteudo" className="landing">
      <section className="hero">
        <div className="wrap hero-inner">
          <div className="hero-copy" data-enter>
            <p className="hero-category"><span/> BUSCA DE VAGAS POR CURRÍCULO</p>
            <h1>Encontre vagas que <em>combinam com você.</em></h1>
            <p className="hero-description">Compare seu currículo com vagas reais e descubra onde suas habilidades atendem ao que as empresas procuram.</p>
            <div className="hero-actions">
              <Button variant="outline" asChild><Link href="/vagas">Explorar vagas <ArrowRight size={17}/></Link></Button>
              <Link className="text-action" href="/vagas?modo=link"><Link2 size={17}/> Analisar vaga por link</Link>
            </div>
          </div>
          <div className="hero-upload" data-enter><ResumeUpload/></div>
          <div className="source-strip">
            <span>Fontes de vagas</span>
            <div className="source-wordmarks" aria-label="Greenhouse, Lever, Ashby e LinkedIn">
              <span>Greenhouse</span><span>Lever</span><span>Ashby</span><span>LinkedIn</span>
            </div>
          </div>
        </div>
      </section>
      <section className="how-section wrap" aria-labelledby="como-funciona">
        <h2 id="como-funciona">Do currículo à candidatura.</h2>
        <div className="steps">
          {steps.map(({icon:Icon,title,description})=>
            <article className="step" key={title}>
              <span className="step-icon"><Icon size={25} strokeWidth={1.6}/></span>
              <h3>{title}</h3><p>{description}</p>
            </article>)}
        </div>
        <div className="benefits-strip">
          <span><ShieldCheck size={18}/> Sem cadastro</span>
          <span><Globe2 size={18}/> Brasil e exterior</span>
          <span><ChartNoAxesColumnIncreasing size={18}/> Compatibilidade explicada</span>
        </div>
      </section>
    </main>
  );
}
