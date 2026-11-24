import type { Metadata } from "next";
import { decodeJobId } from "@/lib/utils";
import { JobDetail } from "@/components/job-detail";

export const metadata: Metadata = {title:"Detalhes da vaga"};

export default async function DetailsPage({params}:PageProps<"/vagas/[id]">) {
  const {id} = await params;
  return <JobDetail id={decodeJobId(id)}/>;
}
