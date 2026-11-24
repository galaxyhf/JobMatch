import { normalizeJob } from "@/lib/jobs/normalize";
import type { Board } from "@/lib/jobs/catalog";

export const greenhouseBoard: Board = {source:"greenhouse",region:"global",company:"Empresa de Teste",slug:"empresa-teste"};
export const leverBoard: Board = {source:"lever",region:"global",company:"Empresa Lever",slug:"empresa-lever"};
export const ashbyBoard: Board = {source:"ashby",region:"global",company:"Empresa Ashby",slug:"empresa-ashby"};
export const testUuid = "12345678-9abc-4def-8765-0123456789ab";
export const posting = {
  id:90210,internal_job_id:91000,title:"Engenheira de Software Sênior",location:{name:"Remoto · Brasil"},
  absolute_url:"https://job-boards.greenhouse.io/empresa-teste/jobs/90210",
  updated_at:"2026-01-01T00:00:00.000Z",
  content:"&lt;p&gt;Crie soluções web e colabore com equipes multidisciplinares.&lt;/p&gt;&lt;h2&gt;Requisitos&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Experiência com React.js e TS&lt;/li&gt;&lt;li&gt;Inglês avançado&lt;/li&gt;&lt;/ul&gt;&lt;h2&gt;Benefícios&lt;/h2&gt;&lt;p&gt;Auxílio educação&lt;/p&gt;",
};

export const leverPosting = {
  id:testUuid,text:"Senior Backend Engineer",description:"<p>Build APIs for our internal products.</p>",
  categories:{location:"Remote · United States",allLocations:["Remote · United States"],commitment:"Full-time"},
  country:"US",workplaceType:"remote",hostedUrl:`https://jobs.lever.co/empresa-lever/${testUuid}`,
  applyUrl:`https://jobs.lever.co/empresa-lever/${testUuid}/apply`,
  lists:[{text:"Required Qualifications",content:"<li>5 years of experience with Node.js and PostgreSQL</li>"}],
  salaryRange:{min:100000,max:125000,currency:"USD",interval:"per-year"},
};

export const ashbyPosting = {
  title:"Designer",location:"Worldwide",workplaceType:"Remote",employmentType:"FullTime",isListed:true,
  descriptionHtml:"<p>Work remotely from anywhere in the world.</p><script>alert(1)</script><h3>Nice to have</h3><ul><li>Figma</li></ul>",
  publishedAt:"2026-01-01T00:00:00.000+00:00",jobUrl:`https://jobs.ashbyhq.com/empresa-ashby/${testUuid}`,
  applyUrl:`https://jobs.ashbyhq.com/empresa-ashby/${testUuid}/application`,
  compensation:{summaryComponents:[{compensationType:"Salary",minValue:80000,maxValue:110000,currencyCode:"USD",interval:"1 YEAR"}]},
};

export const fixtureJob = normalizeJob(greenhouseBoard,posting)!;
