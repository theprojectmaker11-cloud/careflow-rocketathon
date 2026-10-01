import type {
  CareflowSettings,
  Language,
  PatientProfile,
  TriageLevel,
} from "./types";

/* ----------------------------------------------------------------- dates */

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ----------------------------------------------------------------- text */

export function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function bytes(n: number): string {
  if (!n) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Split a long AI paragraph into sentences for comfortable reading. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ----------------------------------------------------------------- labels */

export const LANGUAGES: { key: Language; label: string; native: string }[] = [
  { key: "en", label: "English", native: "English" },
  { key: "roman-ur", label: "Roman Urdu", native: "Roman Urdu" },
  { key: "ur", label: "Urdu", native: "اردو" },
];

export function languageLabel(lang: string): string {
  return LANGUAGES.find((l) => l.key === lang)?.native ?? "English";
}

export const DOC_TYPES: { key: string; label: string; accept: string; hint: string }[] = [
  {
    key: "lab_report",
    label: "Lab report",
    accept: ".pdf,.jpg,.jpeg,.png,.webp",
    hint: "Blood counts, LFT, RFT, thyroid, lipid profile",
  },
  {
    key: "prescription",
    label: "Prescription",
    accept: ".pdf,.jpg,.jpeg,.png,.webp",
    hint: "Medicine name, dose and duration",
  },
  {
    key: "imaging",
    label: "Imaging / scan",
    accept: ".pdf,.jpg,.jpeg,.png,.webp",
    hint: "Ultrasound, X-ray, CT or MRI report",
  },
  {
    key: "discharge_summary",
    label: "Discharge summary",
    accept: ".pdf,.jpg,.jpeg,.png,.webp",
    hint: "Hospital admission and procedure notes",
  },
];

/* ------------------------------------------------------------------ triage */

export interface TriageMeta {
  label: string;
  /** Tailwind class fragment for the badge + border treatment. */
  badge: string;
  dot: string;
  banner: string;
  blurb: string;
}

export const TRIAGE_META: Record<TriageLevel, TriageMeta> = {
  emergency: {
    label: "Urgent — seek care now",
    badge: "bg-alert-soft text-alert-text border-alert-line",
    dot: "bg-alert",
    banner: "border-alert-line bg-alert-soft",
    blurb: "These symptoms can be serious if left untreated. Please get medical help now.",
  },
  urgent: {
    label: "Urgent — same day",
    badge: "bg-alert-soft text-alert-text border-alert-line",
    dot: "bg-alert",
    banner: "border-alert-line bg-alert-soft",
    blurb: "Please arrange a medical review today rather than waiting.",
  },
  soon: {
    label: "See a doctor soon",
    badge: "bg-warn-soft text-warn-text border-warn-line",
    dot: "bg-warn",
    banner: "border-warn-line bg-warn-soft",
    blurb: "Book an appointment in the next few days to look into this.",
  },
  routine: {
    label: "Routine review",
    badge: "bg-info-soft text-info-text border-info-line",
    dot: "bg-info",
    banner: "border-info-line bg-info-soft",
    blurb: "Discuss this at your next scheduled appointment.",
  },
  self_care: {
    label: "Self-care may be enough",
    badge: "bg-ok-soft text-ok-text border-ok-line",
    dot: "bg-ok",
    banner: "border-ok-line bg-ok-soft",
    blurb: "Rest, fluids and monitoring at home are usually reasonable for now.",
  },
};

export function triageMeta(level: TriageLevel): TriageMeta {
  return TRIAGE_META[level] ?? TRIAGE_META.routine;
}

export const URGENT_LEVELS: TriageLevel[] = ["emergency", "urgent"];

/* ----------------------------------------------------- clinical labelling */

export const LAB_STATUS: Record<
  string,
  { label: string; badge: string; dot: string; rank: number }
> = {
  critical_high: { label: "Critically high", badge: "bg-alert-soft text-alert-text border-alert-line", dot: "bg-alert", rank: 5 },
  critical_low: { label: "Critically low", badge: "bg-alert-soft text-alert-text border-alert-line", dot: "bg-alert", rank: 5 },
  high: { label: "High", badge: "bg-warn-soft text-warn-text border-warn-line", dot: "bg-warn", rank: 3 },
  low: { label: "Low", badge: "bg-warn-soft text-warn-text border-warn-line", dot: "bg-warn", rank: 3 },
  normal: { label: "Normal", badge: "bg-ok-soft text-ok-text border-ok-line", dot: "bg-ok", rank: 0 },
  unknown: { label: "Not interpreted", badge: "bg-sunken text-muted border-line", dot: "bg-line-strong", rank: 1 },
};

export function labStatusMeta(status: string | null | undefined) {
  return LAB_STATUS[status ?? "unknown"] ?? LAB_STATUS.unknown;
}

/** Ranked worst-first, for "needs attention" summaries. */
export function attentionCount(statuses: string[]): number {
  return statuses.filter((s) => labStatusMeta(s).rank >= 3).length;
}

export const CAUSE_STATUS: Record<string, { label: string; badge: string; hint: string }> = {
  confirmed: {
    label: "Confirmed",
    badge: "bg-ok-soft text-ok-text border-ok-line",
    hint: "Directly established by your reports or tests.",
  },
  probable: {
    label: "Probable",
    badge: "bg-primary-soft text-primary-text border-primary-line",
    hint: "Strongly suggested by the information available.",
  },
  possible: {
    label: "Possible",
    badge: "bg-warn-soft text-warn-text border-warn-line",
    hint: "Worth considering, but not yet supported by evidence.",
  },
  unlikely: {
    label: "Less likely",
    badge: "bg-sunken text-muted border-line",
    hint: "Does not fit the pattern as well as other options.",
  },
};

export const VERDICT: Record<
  string,
  { label: string; badge: string; blurb: string }
> = {
  appropriate: {
    label: "Looks consistent",
    badge: "bg-ok-soft text-ok-text border-ok-line",
    blurb: "This fits the situation as described, though only a prescriber can confirm.",
  },
  needs_review: {
    label: "Needs doctor review",
    badge: "bg-warn-soft text-warn-text border-warn-line",
    blurb: "There is a reason to have a doctor check this before you continue.",
  },
  unsafe: {
    label: "Potential risk",
    badge: "bg-alert-soft text-alert-text border-alert-line",
    blurb: "Something about this combination looks risky. Do not change it without advice.",
  },
  contraindicated: {
    label: "Likely unsuitable",
    badge: "bg-alert-soft text-alert-text border-alert-line",
    blurb: "This is generally not appropriate in your described situation.",
  },
  insufficient_information: {
    label: "Not enough information",
    badge: "bg-sunken text-muted border-line",
    blurb: "CareFlow cannot assess this safely yet. More detail is needed.",
  },
};

export const MED_ROLE: Record<string, string> = {
  reported_current: "Currently taking",
  patient_proposed: "You asked about",
  assistant_considered: "Considered in your case",
  on_document: "Found on your report",
};

export const CAUSE_FILTERS = ["all", "confirmed", "probable", "possible", "unlikely"] as const;
export type CauseFilter = (typeof CAUSE_FILTERS)[number];

/* -------------------------------------------------------------- defaults */

export const EMPTY_PROFILE: PatientProfile = {
  full_name: "",
  age: null,
  sex: null,
  mrn: "",
  weight_kg: null,
  is_pregnant: false,
  is_breastfeeding: false,
  allergies: [],
  chronic: [],
  current_meds: [],
};

export const DEFAULT_SETTINGS: CareflowSettings = {
  language: "en",
  auto_listen: false,
  keep_history: true,
};

/** Prompts that help a first-time user start without staring at a blank box. */
export const STARTERS = [
  "I've had a fever and body pain for three days",
  "My blood test shows high cholesterol — what should I do?",
  "I'm taking two medicines — is it safe to take them together?",
  "I uploaded a report and I'd like to understand what it means",
];

export const FOLLOW_UPS = [
  "Which of these results are the most important right now?",
  "What should I ask my doctor at the next visit?",
  "Are any of my current medicines interacting?",
  "What symptoms should make me seek urgent care?",
];
