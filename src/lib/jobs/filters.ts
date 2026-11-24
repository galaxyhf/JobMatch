import type { Job, Preferences } from "../schema";
import { technologyKey, terms } from "../terms";
import { fold } from "../utils";

export type SortOption = "match" | "recent" | "salary" | "company";
const yearly = {year:1,month:12,week:52,day:260,hour:2080};

function includesTerms(text: string, query: string) {
  const words = terms(query);
  const haystack = new Set(terms(text));
  return words.length > 0 ? words.every(word=>haystack.has(word)) : fold(text).includes(fold(query));
}

export function passesFilters(job: Job, filters: Preferences) {
  if (filters.role && !includesTerms(job.title,filters.role)) return false;
  if (filters.keywords && !includesTerms([job.title,job.company,job.location,job.description].join(" "),filters.keywords)) return false;
  if (filters.technologies.length) {
    const keys = new Set(job.technologies.map(technologyKey));
    if (!filters.technologies.every(value=>keys.has(technologyKey(value)) || includesTerms(job.description,value))) return false;
  }
  if (filters.countries.length && !(job.workMode==="remote" && job.geography.status==="worldwide") &&
      !filters.countries.some(country=>job.geography.eligibleCountries.includes(country))) return false;
  if (filters.city && !fold(job.location ?? "").includes(fold(filters.city))) return false;
  if (filters.workModes.length && !filters.workModes.includes(job.workMode)) return false;
  if (filters.seniorities.length && (!job.seniority || !filters.seniorities.includes(job.seniority))) return false;
  if (filters.employmentType && fold(job.employmentType ?? "") !== fold(filters.employmentType)) return false;
  if (filters.company && !fold(job.company).includes(fold(filters.company))) return false;
  if (filters.currency && job.salaryCurrency !== filters.currency) return false;
  if (filters.salaryInterval && job.salaryInterval !== filters.salaryInterval) return false;
  if (filters.salaryMin !== null && (job.salaryMin === null || job.salaryMin < filters.salaryMin)) return false;
  if (filters.language && !job.languages.includes(filters.language)) return false;
  if (filters.sources.length && (job.source==="manual" || !filters.sources.includes(job.source))) return false;
  return true;
}

export function sortResults<T extends {job:Job; match:{score:number} | null}>(results: T[], sort: SortOption, currency: string, interval: Preferences["salaryInterval"] = "") {
  return results.sort((a,b) => {
    if (sort==="match") return (b.match?.score ?? -1) - (a.match?.score ?? -1);
    if (sort==="recent") return Date.parse(b.job.publishedAt ?? "1970-01-01") - Date.parse(a.job.publishedAt ?? "1970-01-01");
    if (sort==="company") return a.job.company.localeCompare(b.job.company,"pt-BR") || a.job.title.localeCompare(b.job.title,"pt-BR");
    const pay = (job:Job) => {
      const value = job.salaryMax ?? job.salaryMin;
      if (value === null || !job.salaryCurrency) return -1;
      if (interval) return job.salaryInterval === interval ? value : -1;
      return job.salaryInterval ? value*yearly[job.salaryInterval] : -1;
    };
    if (currency) return pay(b.job)-pay(a.job);
    const aCurrency = pay(a.job)>=0 ? a.job.salaryCurrency : null;
    const bCurrency = pay(b.job)>=0 ? b.job.salaryCurrency : null;
    if (aCurrency === bCurrency) return pay(b.job)-pay(a.job);
    if (!aCurrency) return 1;
    if (!bCurrency) return -1;
    return aCurrency.localeCompare(bCurrency);
  });
}
