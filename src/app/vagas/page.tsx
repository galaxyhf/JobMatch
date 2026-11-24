import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchShell, SearchSkeleton } from "@/components/job-search";

export const metadata: Metadata = {title:"Explorar vagas"};

export default function JobsPage() {
  return <Suspense fallback={<main className="wrap workspace" id="conteudo"><SearchSkeleton/></main>}><SearchShell/></Suspense>;
}
