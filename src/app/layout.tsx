import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { Footer, Navbar } from "@/components/layout";
import { Providers } from "@/components/session";

export const metadata: Metadata = {
  title:{default:"JobMatch — Vagas para o seu perfil",template:"%s | JobMatch"},
  description:"Compare seu currículo com vagas reais e encontre oportunidades que fazem sentido para você.",
  applicationName:"JobMatch",
  other:{"page-type":"software","site-kind":"software"},
};

export default function RootLayout({children}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-type="software" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Providers>
          <a href="#conteudo" className="skip-link">Ir para o conteúdo</a>
          <Navbar/>
          {children}
          <Footer/>
        </Providers>
      </body>
    </html>
  );
}
