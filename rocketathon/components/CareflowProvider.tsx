"use client";

/**
 * Single client-side store for everything the user creates: profile, settings,
 * uploaded reports, past analyses, and the conversation transcript.
 *
 * Persistence is localStorage on purpose — the app works with no account and no
 * database, which is the honest behaviour when Supabase isn't configured. The
 * Profile screen states plainly that this data stays on the device.
 *
 * Implemented as an external store consumed via `useSyncExternalStore`, so the
 * server render and the first client render always agree (both see the empty
 * state) and real data arrives on the subscribe pass without a hydration
 * mismatch.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  CareflowSettings,
  CareflowState,
  ChatTurn,
  PatientProfile,
  StoredAnalysis,
  StoredDocument,
} from "../lib/types";
import { DEFAULT_SETTINGS, EMPTY_PROFILE } from "../lib/format";

const KEY = "careflow.v1";
const LIMITS = { documents: 40, analyses: 50, turns: 150 };

export type BackendStatus = "checking" | "online" | "offline";

interface Store {
  state: CareflowState;
  backend: BackendStatus;
  updateProfile: (patch: Partial<PatientProfile>) => void;
  updateSettings: (patch: Partial<CareflowSettings>) => void;
  addDocument: (doc: StoredDocument) => void;
  removeDocument: (id: string) => void;
  addAnalysis: (item: StoredAnalysis) => void;
  removeAnalysis: (id: string) => void;
  setSessionId: (id: string) => void;
  addTurn: (turn: ChatTurn) => void;
  updateTurn: (id: string, patch: Partial<ChatTurn>) => void;
  resetHistory: () => void;
  clearAll: () => void;
}

const initialState: CareflowState = {
  ready: false,
  profile: EMPTY_PROFILE,
  settings: DEFAULT_SETTINGS,
  session_id: "",
  documents: [],
  analyses: [],
  turns: [],
};

const CareflowContext = createContext<Store | null>(null);

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Never persist the full OCR text — it is the largest field and is re-fetchable. */
function slimDocument(doc: StoredDocument): StoredDocument {
  return { ...doc, findings: doc.findings.slice(0, 60) };
}

function readStorage(): CareflowState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...initialState, ready: true, session_id: newSessionId() };
    const parsed = JSON.parse(raw) as Partial<CareflowState>;
    const session_id =
      typeof parsed.session_id === "string" && parsed.session_id
        ? parsed.session_id
        : newSessionId();
    return {
      ready: true,
      profile: { ...EMPTY_PROFILE, ...(parsed.profile ?? {}) },
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      session_id,
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      analyses: Array.isArray(parsed.analyses) ? parsed.analyses : [],
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
    };
  } catch {
    return { ...initialState, ready: true, session_id: newSessionId() };
  }
}

/* ------------------------------------------------- external store plumbing */

let snapshot: CareflowState = initialState;
const listeners = new Set<() => void>();
let hydrated = false;

function emit(next: CareflowState) {
  snapshot = next;
  try {
    const { ready: _ready, ...persist } = next;
    void _ready;
    window.localStorage.setItem(KEY, JSON.stringify(persist));
  } catch {
    /* quota exceeded or private mode — the session still works in memory */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Hydrate on the first subscribe — this runs after the initial client render,
  // so the server HTML and the first client paint both see the empty state.
  if (!hydrated) {
    hydrated = true;
    snapshot = readStorage();
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== KEY) return;
    snapshot = readStorage();
    for (const l of listeners) l();
  }
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => initialState;

/* ---------------------------------------------------------------- provider */

export function CareflowProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [backend, setBackend] = useState<BackendStatus>("checking");

  // Probe the API once so the UI can say so honestly when it is unreachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = await res.json();
        if (!cancelled) setBackend(res.ok && body?.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setBackend("offline");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const store = useMemo<Store>(
    () => ({
      state,
      backend,
      updateProfile: (patch) =>
        emit({ ...snapshot, profile: { ...snapshot.profile, ...patch } }),
      updateSettings: (patch) =>
        emit({ ...snapshot, settings: { ...snapshot.settings, ...patch } }),
      addDocument: (doc) =>
        emit({
          ...snapshot,
          documents: [slimDocument(doc), ...snapshot.documents].slice(0, LIMITS.documents),
        }),
      removeDocument: (id) =>
        emit({ ...snapshot, documents: snapshot.documents.filter((d) => d.id !== id) }),
      addAnalysis: (item) =>
        emit({ ...snapshot, analyses: [item, ...snapshot.analyses].slice(0, LIMITS.analyses) }),
      removeAnalysis: (id) =>
        emit({ ...snapshot, analyses: snapshot.analyses.filter((a) => a.id !== id) }),
      setSessionId: (id) => emit({ ...snapshot, session_id: id }),
      addTurn: (turn) => emit({ ...snapshot, turns: [...snapshot.turns, turn].slice(-LIMITS.turns) }),
      updateTurn: (id, patch) =>
        emit({
          ...snapshot,
          turns: snapshot.turns.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }),
      resetHistory: () => emit({ ...snapshot, analyses: [], turns: [] }),
      clearAll: () =>
        emit({
          ...initialState,
          ready: true,
          profile: EMPTY_PROFILE,
          settings: DEFAULT_SETTINGS,
          session_id: newSessionId(),
        }),
    }),
    [state, backend],
  );

  return <CareflowContext.Provider value={store}>{children}</CareflowContext.Provider>;
}

export function useCareflow(): Store {
  const ctx = useContext(CareflowContext);
  if (!ctx) throw new Error("useCareflow must be used inside <CareflowProvider>");
  return ctx;
}
