import { publicationPeriodSeconds, type Preferences } from "../schema";
import { countryName } from "../terms";
import { compact, safeExternalUrl } from "../utils";

export function linkedinSearchUrl({keywords,role,city,countries,publicationPeriod}: Pick<Preferences,"keywords"|"role"|"city"|"countries"|"publicationPeriod">) {
  const url = new URL("https://www.linkedin.com/jobs/search/");
  const terms = [...new Set([role,keywords].map(compact).filter(Boolean))].join(" ");
  const location = [compact(city),countries.length === 1 ? countryName(countries[0]) : ""].filter(Boolean).join(", ");
  if (terms) url.searchParams.set("keywords",terms);
  if (location) url.searchParams.set("location",location);
  if (publicationPeriod) url.searchParams.set("f_TPR",`r${publicationPeriodSeconds[publicationPeriod]}`);
  return url.href;
}

export function isLinkedInJobUrl(input: string) {
  const url = safeExternalUrl(input.trim());
  return Boolean(url && /(?:^|\.)linkedin\.com$/.test(url.hostname) && /^\/jobs\/view\/[^/]+\/?$/.test(url.pathname));
}
