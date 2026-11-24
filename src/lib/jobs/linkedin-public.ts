import { DomUtils, parseDocument } from "htmlparser2";
import { z } from "zod";
import { publicationPeriodSeconds, type Job } from "../schema";
import { compact } from "../utils";
import { plainHtml } from "./content";
import type { LinkedInSearch } from "./linkedin";
import { jobFromPosting } from "./normalize";

const origin = "https://www.linkedin.com";
type Element = ReturnType<typeof DomUtils.findAll>[number];

export function isLinkedInHost(host: string) {
  return /^(?:www|[a-z]{2})\.linkedin\.com$/.test(host);
}
const countryNames = new Intl.DisplayNames(["en"],{type:"region"});
const locationMode = {onsite:"1",remote:"2",hybrid:"3",unknown:""} as const;
const linkedInDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d\d-\d\d(?:T|$)/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

export function linkedInListUrl(search: LinkedInSearch) {
  const url = new URL("/jobs-guest/jobs/api/seeMoreJobPostings/search",origin);
  const country = search.countries.length===1 ? search.countries[0] : undefined;
  const keywords = [...new Set([search.role,search.keywords,search.company,...search.technologies].map(compact).filter(Boolean))].join(" ").slice(0,600).trim();
  const location = [compact(search.city),country ? countryNames.of(country) : ""].filter(Boolean).join(", ");
  if (keywords) url.searchParams.set("keywords",keywords);
  if (location) url.searchParams.set("location",location);
  if (country==="BR" && !search.city) url.searchParams.set("geoId","106057199");
  if (search.publicationPeriod) url.searchParams.set("f_TPR",`r${publicationPeriodSeconds[search.publicationPeriod]}`);
  const modes = search.workModes.map(mode=>locationMode[mode]).filter(Boolean).sort();
  if (modes.length && !search.workModes.includes("unknown")) url.searchParams.set("f_WT",modes.join(","));
  url.searchParams.set("start","0");
  return url.href;
}

export function linkedInPostingUrl(id: string, value?: string) {
  const path = value || `/jobs/view/${id}`;
  if (!URL.canParse(path,origin)) return null;
  const url = new URL(path,origin);
  const slug = url.pathname.match(/^\/jobs\/view\/([a-z0-9%-]+)\/?$/i)?.[1];
  if (url.protocol!=="https:" || url.port || !isLinkedInHost(url.hostname) || url.username || url.password || !(slug===id || slug?.endsWith(`-${id}`))) return null;
  return url.origin + url.pathname.replace(/\/$/,"");
}

const hasClass = (node: Element, name: string) => node.attribs.class?.split(/\s+/).includes(name);
const findClass = (nodes: Element["children"], name: string) => DomUtils.findOne(node=>Boolean(hasClass(node,name)),nodes);
const content = (node: Element | null) => node ? compact(DomUtils.textContent(node)) : "";

export function parseLinkedInList(html: string) {
  const document = parseDocument(html);
  const cards = DomUtils.findAll(node=>Boolean(hasClass(node,"job-search-card")),document.children);
  if (!cards.length && html.replace(/^\s*<!doctype html>/i,"").trim()) throw new Error("LinkedIn search markup");
  const jobs = cards.flatMap(card=>{
    const id = card.attribs["data-entity-urn"]?.match(/^urn:li:jobPosting:(\d{1,18})$/)?.[1];
    const title = content(findClass(card.children,"base-search-card__title"));
    const company = content(findClass(card.children,"base-search-card__subtitle"));
    const href = findClass(card.children,"base-card__full-link")?.attribs.href;
    if (!id || !title || !company || !href) return [];
    const sourceUrl = linkedInPostingUrl(id,href);
    if (!sourceUrl) return [];
    const time = DomUtils.findOne(node=>node.name==="time",card.children);
    const job = jobFromPosting("linkedin",`linkedin:${id}`,company,{
      externalId:id,title,sourceUrl,description:"",
      location:content(findClass(card.children,"job-search-card__location")),
      publishedAt:linkedInDate(time?.attribs.datetime),
    });
    return job ? [job] : [];
  });
  if (cards.length && !jobs.length) throw new Error("LinkedIn card markup");
  return jobs;
}

const address = z.object({addressCountry:z.string().nullish(),addressLocality:z.string().nullish(),addressRegion:z.string().nullish()});
const place = z.object({address:address.optional()});
const posting = z.object({
  "@type":z.literal("JobPosting"),
  title:z.string().min(1),
  hiringOrganization:z.object({name:z.string().min(1)}),
  description:z.string().optional(),
  datePosted:z.string().optional(),
  jobLocation:z.union([place,z.array(place)]).optional(),
  jobLocationType:z.string().optional(),
  employmentType:z.union([z.string(),z.array(z.string())]).optional(),
});

export function parseLinkedInDetail(html: string, id: string, sourceUrl: string, summary?: Job) {
  const document = parseDocument(html);
  const scripts = DomUtils.findAll(node=>node.name==="script" && node.attribs.type==="application/ld+json",document.children);
  for (const script of scripts) {
    try {
      const parsed = posting.safeParse(JSON.parse(DomUtils.getChildren(script).map(node=>node.type==="text" ? node.data : "").join("")));
      if (!parsed.success) continue;
      const data = parsed.data;
      const addresses = [data.jobLocation].flat().flatMap(place=>place?.address ? [place.address] : []);
      const description = findClass(document.children,"show-more-less-html__markup");
      const job = jobFromPosting("linkedin",`linkedin:${id}`,data.hiringOrganization.name,{
        externalId:id,title:data.title,sourceUrl,
        description:description ? plainHtml(DomUtils.getInnerHTML(description)) : plainHtml(data.description ?? "",true),
        location:summary?.location ?? addresses.map(address=>[address.addressLocality,address.addressRegion,address.addressCountry].filter(Boolean).join(", ")).filter(Boolean).join(" · "),
        publishedAt:linkedInDate(data.datePosted) ?? summary?.publishedAt,
        mode:data.jobLocationType==="TELECOMMUTE" ? "remote" : undefined,
        employment:[data.employmentType].flat().filter(Boolean).join(" ").replaceAll("_"," "),
      });
      if (job) return job;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error("LinkedIn posting markup");
}
