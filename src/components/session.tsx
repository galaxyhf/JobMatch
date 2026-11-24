"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Toaster } from "sonner";
import { emptyPreferences, preferencesSchema, type Job, type ParsedResume, type Preferences } from "@/lib/schema";

const settingsKey = "jobmatch-preferencias-v1";
const applicationsKey = "jobmatch-candidaturas-v1";

function readLocal(key:string) {
  try {return localStorage.getItem(key);}
  catch {return null;}
}

function subscribeStorage(callback:()=>void) {
  window.addEventListener("storage",callback);
  return ()=>window.removeEventListener("storage",callback);
}

function useLocalValue(key:string) {
  return useSyncExternalStore(subscribeStorage,()=>readLocal(key),()=>null);
}

function loadSettings(raw: string | null) {
  try {
    const result = preferencesSchema.safeParse(JSON.parse(raw ?? "null"));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function readApplications(raw: string | null): string[] {
  try {
    const stored: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(stored) ? stored.filter((item):item is string=>typeof item === "string" && item.length <= 300).slice(0,300) : [];
  } catch {
    return [];
  }
}

type Session = {
  draft: {resume:ParsedResume; filename:string} | null;
  setDraft: (value: Session["draft"])=>void;
  resume: ParsedResume | null;
  setResume: (value:ParsedResume | null)=>void;
  preferences: Preferences;
  setPreferences: (value:Preferences)=>void;
  persist: boolean;
  setPersist: (value:boolean)=>boolean;
  selected: Record<string,Job>;
  selectJob: (job:Job)=>void;
  applications:string[];
  toggleApplication: (id:string)=>boolean;
};

const SessionContext = createContext<Session | null>(null);

export function Providers({children}:{children:ReactNode}) {
  const [query] = useState(() => new QueryClient({defaultOptions:{queries:{staleTime:180_000,retry:false,refetchOnWindowFocus:false}}}));
  const [draft,setDraft] = useState<Session["draft"]>(null);
  const [resume,setResume] = useState<ParsedResume | null>(null);
  const storedSettings = useLocalValue(settingsKey);
  const saved = useMemo(()=>loadSettings(storedSettings),[storedSettings]);
  const [preferencesDraft,setPreferencesState] = useState<Preferences | null>(null);
  const [persistDraft,setPersistState] = useState<boolean | null>(null);
  const preferences = preferencesDraft ?? saved ?? emptyPreferences;
  const persist = persistDraft ?? Boolean(saved);
  const [selected,setSelected] = useState<Record<string,Job>>({});
  const storedApplications = useLocalValue(applicationsKey);
  const [applicationsDraft,setApplications] = useState<string[] | null>(null);
  const parsedApplications = useMemo(()=>readApplications(storedApplications),[storedApplications]);
  const applications = applicationsDraft ?? parsedApplications;

  function writeSettings(value: Preferences | null) {
    try {
      if (value) localStorage.setItem(settingsKey,JSON.stringify(value));
      else localStorage.removeItem(settingsKey);
      return true;
    } catch { return false; }
  }

  const session: Session = {
    draft,setDraft,resume,setResume,preferences,persist,selected,applications,
    setPreferences(value) {
      setPreferencesState(value);
      if (persist && !writeSettings(value)) setPersistState(false);
    },
    setPersist(value) {
      if (!writeSettings(value ? preferences : null)) return false;
      setPersistState(value);
      return true;
    },
    selectJob(job) {
      setSelected(previous=>Object.fromEntries([...Object.entries(previous).filter(([id])=>id!==job.id).slice(-39),[job.id,job]]));
    },
    toggleApplication(id) {
      const next = applications.includes(id) ? applications.filter(item=>item!==id) : [...applications,id].slice(-300);
      setApplications(next);
      try {
        localStorage.setItem(applicationsKey, JSON.stringify(next));
        return true;
      } catch { return false; }
    },
  };

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={query}>
        <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
        <AppToaster/>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "light" ? "light" : "dark"} position="bottom-right" closeButton/>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Session provider unavailable");
  return session;
}
