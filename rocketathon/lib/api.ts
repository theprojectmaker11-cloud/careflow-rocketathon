/**
 * Thin client over the Next.js proxy routes. The browser never talks to the
 * FastAPI service directly, so there is no CORS surface and no chance of a
 * backend URL leaking into the client bundle.
 */

import type {
  AskResponse,
  ChatTurn,
  DocumentRef,
  HealthStatus,
  LabResultRow,
  PatientSummary,
  StoredDocument,
  UploadResponse,
} from "./types";

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join("; ");
    }
  } catch {
    /* non-JSON error body */
  }
  return `Request failed (${res.status})`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------- chat */

export async function askAssistant(payload: {
  message: string;
  language: string;
  session_id?: string | null;
  document_ids?: string[];
  patient?: unknown;
}): Promise<AskResponse> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return json<AskResponse>(res);
}

/* -------------------------------------------------------------- documents */

export async function uploadDocument(
  file: File,
  patientMrn?: string,
  patientAge?: number,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  if (patientMrn) form.append("patient_mrn", patientMrn);
  if (patientAge != null) form.append("patient_age", String(patientAge));
  const res = await fetch("/api/documents", { method: "POST", body: form });
  return json<UploadResponse>(res);
}

export async function fetchDocument(id: string): Promise<DocumentRef> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, { cache: "no-store" });
  return json<DocumentRef>(res);
}

export function toStoredDocument(file: File, doc: DocumentRef): StoredDocument {
  return {
    id: doc.id,
    file_name: doc.file_name || file.name,
    doc_type: doc.doc_type,
    mime: file.type || "application/octet-stream",
    size_bytes: file.size,
    uploaded_at: new Date().toISOString(),
    findings: doc.findings ?? [],
    reported_medications: doc.reported_medications ?? [],
    impressions: doc.impressions ?? [],
  };
}

/* ---------------------------------------------------------------- patient */

export async function fetchPatient(mrn: string): Promise<PatientSummary> {
  const res = await fetch(`/api/patient?mrn=${encodeURIComponent(mrn)}`, { cache: "no-store" });
  return json<PatientSummary>(res);
}

export async function fetchLabs(
  mrn: string,
  limit = 25,
): Promise<{ results: LabResultRow[]; total: number }> {
  const res = await fetch(
    `/api/patient?mrn=${encodeURIComponent(mrn)}&labs=1&limit=${limit}`,
    { cache: "no-store" },
  );
  return json<{ results: LabResultRow[]; total: number }>(res);
}

export async function fetchHistory(
  sessionId: string,
): Promise<{ assessments: unknown[]; history: unknown[] }> {
  const res = await fetch(
    `/api/history?session_id=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  );
  return json<{ assessments: unknown[]; history: unknown[] }>(res);
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch("/api/health", { cache: "no-store" });
  return json<HealthStatus>(res);
}

/* ------------------------------------------------------------------ turns */

export function newTurn(
  role: ChatTurn["role"],
  message: string,
  extra: Partial<ChatTurn> = {},
): ChatTurn {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    message,
    created_at: new Date().toISOString(),
    ...extra,
  };
}
