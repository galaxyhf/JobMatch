import type { Metadata } from "next";
import { decodeJobId } from "@/lib/utils";
import { Personalization } from "@/components/personalization";

export const metadata: Metadata = {title:"Personalizar currículo"};

export default async function PersonalizationPage({params}:PageProps<"/curriculo/[id]">) {
  const {id} = await params;
  return <Personalization id={decodeJobId(id)}/>;
}
