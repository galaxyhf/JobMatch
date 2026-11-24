"use client";

import { ScanLine, Moon, Sun, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";

export function Brand() {
  return <Link href="/" className="brand" aria-label="JobMatch, início"><span className="brand-symbol"><ScanLine size={23} strokeWidth={2.4}/></span><span>Job<span className="brand-match">Match</span></span></Link>;
}

export function Navbar() {
  const path = usePathname();
  const {resolvedTheme,setTheme} = useTheme();
  return (
    <header className="topbar">
      <div className="wrap bar-inner">
        <Brand/>
        <nav aria-label="Navegação principal" className="nav-links">
          <Link href="/vagas" aria-current={path.startsWith("/vagas") ? "page" : undefined}>Explorar vagas</Link>
          <Link href="/curriculo" aria-current={path.startsWith("/curriculo") ? "page" : undefined}>Meu currículo</Link>
        </nav>
        <Button variant="ghost" size="icon" aria-label="Alternar tema" className="theme-button"
          onClick={()=>setTheme(resolvedTheme === "light" ? "dark" : "light")}>
          <Sun size={19} className="theme-sun" aria-hidden="true"/>
          <Moon size={19} className="theme-moon" aria-hidden="true"/>
        </Button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <Brand/>
        <p>Uma busca de vagas sem cadastro.</p>
        <Link href="/privacidade">Privacidade <ExternalLink size={13}/></Link>
      </div>
    </footer>
  );
}
