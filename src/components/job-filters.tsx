"use client";

import { useState } from "react";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { emptyPreferences, employmentNames, languageNames, modeNames, providers, salaryIntervals, seniorities, seniorityNames, sourceNames, type Preferences } from "@/lib/schema";
import { countryName, countryOptions } from "@/lib/terms";
import { Button } from "./ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useSession } from "./session";

const modalities = ["remote","hybrid","onsite"] as const;
const currencies = ["BRL","USD","EUR","GBP","CAD","AUD","MXN","ARS","CHF","INR","JPY"];
const intervalNames = {year:"Anual",month:"Mensal",week:"Semanal",day:"Diário",hour:"Por hora"};
const toggle = <T,>(items:T[], value:T) => items.includes(value) ? items.filter(item=>item!==value) : [...items,value];

export function countFilters(value:Preferences) {
  return Object.entries(value).filter(([key,item])=>key!=="keywords" && (Array.isArray(item) ? item.length>0 : Boolean(item) || (key==="salaryMin" && item===0))).length;
}

function FilterFields({value,onChange,clear}:{value:Preferences;onChange:(value:Preferences)=>void;clear:()=>void}) {
  const {persist,setPersist} = useSession();
  const [techInput,setTechInput] = useState<string | null>(null);
  const patch = <K extends keyof Preferences,>(key:K, next:Preferences[K])=>onChange({...value,[key]:next});
  function updatePersistence(checked:boolean) {
    if (setPersist(checked)) toast.success(checked ? "Preferências salvas neste navegador." : "Preferências removidas do armazenamento.");
    else toast.error("O navegador bloqueou o armazenamento local.");
  }
  return (
    <div className="filter-fields">
      <label className="field">Cargo desejado<input placeholder="Ex.: Analista de dados" maxLength={300} value={value.role} onChange={e=>patch("role",e.target.value)}/></label>
      <label className="field">Tecnologias<input placeholder="Ex.: React, SQL" maxLength={300} value={techInput ?? value.technologies.join(", ")}
        onChange={e=>{setTechInput(e.target.value);patch("technologies",e.target.value.split(",").map(value=>value.trim()).filter(Boolean).slice(0,30));}}/></label>
      <label className="field">Empresa<input placeholder="Nome da empresa" maxLength={300} value={value.company} onChange={e=>patch("company",e.target.value)}/></label>
      <fieldset className="field check-group">
        <legend>Modalidade</legend>
        {modalities.map(key=><label className="check" key={key}><input type="checkbox" checked={value.workModes.includes(key)} onChange={()=>patch("workModes",toggle(value.workModes,key))}/>{modeNames[key]}</label>)}
      </fieldset>
      <div className="field">
        <label className="field">Países
          <select value="" onChange={e=>{const country=e.target.value;if(country && value.countries.length<40) patch("countries",toggle(value.countries,country));}}>
            <option value="">Adicionar país</option>
            {["BR",...countryOptions.filter(code=>code!=="BR")].filter(code=>!value.countries.includes(code)).map(code=><option key={code} value={code}>{countryName(code)}</option>)}
          </select>
        </label>
        {value.countries.length>0 && <div className="chips">
          {value.countries.map(code=><button className="chip removable-chip" type="button" key={code} onClick={()=>patch("countries",toggle(value.countries,code))}
            aria-label={`Remover ${countryName(code)}`}>{countryName(code)} <span aria-hidden="true">×</span></button>)}
        </div>}
      </div>
      <label className="field">Cidade<input placeholder="Ex.: São Paulo" maxLength={300} value={value.city} onChange={e=>patch("city",e.target.value)}/></label>
      <fieldset className="field check-group">
        <legend>Senioridade</legend>
        {seniorities.map(key=><label className="check" key={key}><input type="checkbox" checked={value.seniorities.includes(key)} onChange={()=>patch("seniorities",toggle(value.seniorities,key))}/>{seniorityNames[key]}</label>)}
      </fieldset>
      <label className="field">Tipo de contratação<select value={value.employmentType} onChange={e=>patch("employmentType",e.target.value)}>
        <option value="">Todos os tipos</option>{Object.entries(employmentNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select></label>
      <label className="field">Salário mínimo<input type="number" min={0} max={1e9} step="any" placeholder="Valor anunciado"
        value={value.salaryMin ?? ""} onChange={e=>patch("salaryMin", e.target.value==="" ? null : Math.max(0,Math.min(1e9,Number(e.target.value))))}/></label>
      <label className="field">Moeda<select value={value.currency} onChange={e=>patch("currency",e.target.value)}>
        <option value="">Todas as moedas</option>{currencies.map(code=><option key={code} value={code}>{code}</option>)}
      </select></label>
      <label className="field">Período do salário<select value={value.salaryInterval} onChange={e=>patch("salaryInterval",e.target.value as Preferences["salaryInterval"])}>
        <option value="">Qualquer período</option>{salaryIntervals.map(key=><option key={key} value={key}>{intervalNames[key]}</option>)}
      </select></label>
      <label className="field">Idioma exigido<select value={value.language} onChange={e=>patch("language",e.target.value as Preferences["language"])}>
        <option value="">Todos os idiomas</option>{Object.entries(languageNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select></label>
      <fieldset className="field check-group">
        <legend>Fonte</legend>
        {providers.map(key=><label className="check" key={key}><input type="checkbox" checked={value.sources.includes(key)} onChange={()=>patch("sources",toggle(value.sources,key))}/>{sourceNames[key]}</label>)}
      </fieldset>
      <label className="field">Compatibilidade mínima <strong>{value.minMatch}%</strong>
        <input type="range" min={0} max={100} step={5} value={value.minMatch}
          onChange={e=>patch("minMatch",Number(e.target.value))}/>
      </label>
      <div className="filter-bottom">
        <label className="check"><input type="checkbox" checked={persist} onChange={e=>updatePersistence(e.target.checked)}/> Salvar preferências</label>
        <Button variant="ghost" size="sm" onClick={()=>{setTechInput("");clear();}}><Trash2 size={15}/> Limpar filtros</Button>
      </div>
    </div>
  );
}

export function JobFilters({value,onChange,version,onClear}:{
  value:Preferences;onChange:(value:Preferences)=>void;version:number;onClear:()=>void;
}) {
  const [open,setOpen] = useState(false);
  function clear() {
    onChange(emptyPreferences);
    onClear();
  }
  return (
    <>
      <aside className="desktop-filters panel" aria-label="Filtros de vagas">
        <h2><SlidersHorizontal size={18}/> Filtros</h2><FilterFields key={version} value={value} onChange={onChange} clear={clear}/>
      </aside>
      <div className="mobile-filters">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="outline" size="sm"><SlidersHorizontal size={16}/> Filtros {countFilters(value)>0 && <span className="filter-count">{countFilters(value)}</span>}</Button></DialogTrigger>
          <DialogContent className="filter-drawer">
            <DialogTitle>Filtros de vagas</DialogTitle>
            <DialogDescription className="muted">Ajuste os resultados de acordo com suas preferências.</DialogDescription>
            <FilterFields key={version} value={value} onChange={onChange} clear={clear}/>
            <DialogClose asChild><Button className="drawer-done">Ver resultados</Button></DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
