import { preferencesSchema } from "../schema";
import { safeExternalUrl } from "../utils";

export const linkedInSearchSchema = preferencesSchema.pick({
  keywords:true,role:true,city:true,countries:true,publicationPeriod:true,company:true,technologies:true,workModes:true,
});
export type LinkedInSearch = ReturnType<typeof linkedInSearchSchema.parse>;

export function isLinkedInJobUrl(input: string) {
  const url = safeExternalUrl(input.trim());
  return Boolean(url && /(?:^|\.)linkedin\.com$/.test(url.hostname) && /^\/jobs\/view\/[^/]+\/?$/.test(url.pathname));
}
