import type { Metadata } from "next";
import { ResumeEditor } from "@/components/resume-editor";

export const metadata: Metadata = {title:"Meu currículo"};
export default function ResumePage() {
  return <ResumeEditor/>;
}
