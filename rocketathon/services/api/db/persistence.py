"""Persistence for patients, documents, sessions, assessments and triage events.

Every write is best-effort: a database failure must never cost a patient their answer.
The answer is always returned to the caller even if nothing could be stored.
"""

from __future__ import annotations

import logging

from aikti.models import (
    AskRequest,
    DocumentExtraction,
    DocumentRef,
    PatientAssessment,
    PatientRef,
    TriageLevel,
    TriageScreen,
)
from db.mongo import append_chat_turn, get_db, next_seq
from db.supabase import get_supabase, maybe_one

log = logging.getLogger(__name__)


def _try(fn, label: str):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        log.warning("%s failed: %s", label, exc)
        return None


# ================================================================ patients
def upsert_patient(ref: PatientRef | None) -> str | None:
    if not ref:
        return None
    supabase = get_supabase()
    if ref.id:
        return ref.id
    if ref.mrn:
        found = _try(
            lambda: maybe_one(supabase.table("patients").select("id").eq("mrn", ref.mrn)),
            "lookup patient by mrn",
        )
        if found:
            return found["id"]
    row = {
        "full_name": ref.full_name or "Unknown",
        "mrn": ref.mrn or None,
        "age": ref.age,
        "sex": ref.sex,
        "language": ref.language,
        "allergies": ref.allergies,
        "chronic": ref.chronic,
        "current_meds": ref.current_meds,
    }
    created = _try(lambda: supabase.table("patients").insert(row).execute().data, "insert patient")
    if created:
        return created[0]["id"]
    # MRN is NOT NULL + unique; generate one when the patient did not supply it
    fallback = f"MRN-{abs(hash((ref.full_name or 'anon') + (ref.age or 0).__str__())) % 10**8:08d}"
    created = _try(
        lambda: supabase.table("patients").insert({**row, "mrn": fallback}).execute().data,
        "insert patient with generated mrn",
    )
    return created[0]["id"] if created else None


# ================================================================ documents
def save_document(
    patient_id: str | None,
    file_name: str,
    mime_type: str,
    storage_path: str | None,
    extraction: DocumentExtraction,
) -> str | None:
    supabase = get_supabase()
    row = {
        "patient_id": patient_id,
        "storage_path": storage_path,
        "file_name": file_name,
        "mime_type": mime_type,
        "doc_type": extraction.doc_type,
        "raw_text": extraction.raw_text,
        "findings": [f.model_dump() for f in extraction.findings],
    }
    created = _try(lambda: supabase.table("documents").insert(row).execute().data, "insert document")
    if not created:
        return None
    doc_id = created[0]["id"]
    if extraction.findings:
        _try(
            lambda: supabase.table("lab_results").insert(
                [
                    {
                        "patient_id": patient_id,
                        "document_id": doc_id,
                        "test_name": f.test_name,
                        "value_raw": f.value,
                        "unit": f.unit,
                        "ref_range": f.reference_range,
                        "status": None,
                    }
                    for f in extraction.findings
                ]
            ).execute(),
            "insert lab_results",
        )
    return doc_id


def load_documents(doc_ids: list[str]) -> list[DocumentRef]:
    if not doc_ids:
        return []
    supabase = get_supabase()
    rows = _try(
        lambda: supabase.table("documents").select("*").in_("id", doc_ids).execute().data,
        "load documents",
    ) or []
    out = []
    for r in rows:
        findings = [f for f in (r.get("findings") or [])]
        out.append(
            DocumentRef(
                id=r["id"],
                file_name=r.get("file_name"),
                doc_type=r.get("doc_type"),
                findings=findings,
                reported_medications=(r.get("findings") or {}).get("medications", []) if isinstance(r.get("findings"), dict) else [],
                impressions=(r.get("findings") or {}).get("impressions", []) if isinstance(r.get("findings"), dict) else [],
                raw_text=r.get("raw_text"),
            )
        )
    return out


# ================================================================ sessions
def get_or_create_session(session_id: str | None, patient_id: str | None, language: str, channel: str = "web") -> str:
    supabase = get_supabase()
    if session_id:
        found = _try(lambda: maybe_one(supabase.table("chat_sessions").select("id").eq("id", session_id)), "load session")
        if found:
            return found["id"]
    created = _try(
        lambda: supabase.table("chat_sessions")
        .insert({"patient_id": patient_id, "language": language, "channel": channel})
        .execute().data,
        "create session",
    )
    return created[0]["id"] if created else (session_id or "")


def record_triage(session_id: str, patient_id: str | None, triage: TriageScreen, trace_id: str | None) -> None:
    supabase = get_supabase()
    payload = {
        "session_id": session_id or None,
        "patient_id": patient_id,
        "level": triage.level,
        "is_emergency": triage.is_emergency,
        "red_flags": triage.red_flags,
        "advice": triage.immediate_advice,
        "trace_id": trace_id,
    }
    _try(lambda: supabase.table("triage_events").insert(payload).execute(), "insert triage_event")
    _try(
        lambda: supabase.table("chat_sessions").update({"last_triage": triage.level}).eq("id", session_id).execute(),
        "update session triage",
    )


def save_assessment(
    session_id: str,
    patient_id: str | None,
    question: str,
    triage: TriageScreen,
    assessment: PatientAssessment,
    trace_id: str | None,
    latency_ms: int | None,
) -> str | None:
    supabase = get_supabase()
    row = {
        "session_id": session_id or None,
        "patient_id": patient_id,
        "question": question[:4000],
        "triage_level": triage.level,
        "is_emergency": triage.is_emergency,
        "patient_summary": assessment.patient_summary,
        "important_findings": assessment.important_symptoms_findings,
        "test_interpretation": assessment.test_report_interpretation,
        "possible_causes": [c.model_dump() for c in assessment.possible_causes],
        "medication_safety": [m.model_dump() for m in assessment.medication_safety],
        "treatment_guidance": assessment.treatment_guidance,
        "next_steps": assessment.next_steps,
        "warning_signs": assessment.warning_signs,
        "information_needed": assessment.information_needed,
        "confidence": assessment.confidence,
        "trace_id": trace_id,
        "latency_ms": latency_ms,
    }
    created = _try(lambda: supabase.table("assessments").insert(row).execute().data, "insert assessment")
    return created[0]["id"] if created else None


# ================================================================ mongo chat history
def append_turns(session_id: str, user_message: str, assistant_summary: str) -> None:
    seq = _try(lambda: next_seq(session_id), "next seq") or 0
    _try(lambda: append_chat_turn(session_id, seq, "user", user_message), "append user turn")
    _try(lambda: append_chat_turn(session_id, seq + 1, "assistant", assistant_summary), "append assistant turn")


def load_history(session_id: str, limit: int = 12) -> list[dict]:
    rows = _try(
        lambda: list(
            get_db().chat_turns.find({"session_id": session_id}, {"_id": 0, "role": 1, "content": 1})
            .sort("created_at", -1)
            .limit(limit)
        ),
        "load history",
    ) or []
    return list(reversed(rows))
