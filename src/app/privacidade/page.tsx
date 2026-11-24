import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {title:"Privacidade"};

export default function PrivacyPage() {
  return (
    <main id="conteudo" className="wrap workspace narrow">
      <Link href="/" className="back-link"><ArrowLeft size={16}/> Início</Link>
      <h1>Privacidade</h1>
      <div className="prose-section">
        <h2>Leitura do arquivo</h2>
        <p>O arquivo é enviado ao servidor do JobMatch para extrair o texto. O processamento ocorre em memória e o arquivo é descartado ao fim da solicitação.</p>
        <h2>Dados da sessão</h2>
        <p>O currículo revisado e a pontuação de compatibilidade ficam na memória desta aba. Recarregar a página ou fechar a aba encerra essa sessão. Greenhouse, Lever e Ashby recebem consultas aos quadros públicos. O LinkedIn recebe os termos de busca e filtros de vagas aplicáveis.</p>
        <h2>Preferências e candidaturas</h2>
        <p>As preferências são gravadas localmente apenas quando você ativa essa opção no painel de filtros. Ao marcar uma candidatura, o navegador guarda o identificador da vaga. Você pode desmarcá-la nos detalhes da vaga.</p>
        <h2>Links externos</h2>
        <p>As candidaturas são abertas no site indicado pelo anúncio. A política de privacidade do site de destino passa a valer para as informações que você fornecer ali.</p>
      </div>
    </main>
  );
}
