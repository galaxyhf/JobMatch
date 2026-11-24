import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main id="conteudo" className="workspace wrap narrow"><div className="empty-state panel">
    <h1>Página não encontrada</h1><Button asChild><Link href="/">Voltar ao início</Link></Button>
  </div></main>;
}
