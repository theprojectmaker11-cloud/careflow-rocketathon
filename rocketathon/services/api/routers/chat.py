"""The patient chat endpoint: triage, then the eight-section assessment."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from aikti.config import get_settings
from aikti.models import AskRequest, AskResponse, AskResponse as _AskResponse
from db import persistence as store
from med_agents.assistant import run_full_pipeline

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["assistant"])


@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    patient_id = store.upsert_patient(req.patient)
    session_id = store.get_or_create_session(req.session_id, patient_id, req.language)
    docs = store.load_documents(req.document_ids)
    history = store.load_history(session_id)

    try:
        triage, assessment, trace_id, latency_ms, citations = await run_full_pipeline(req, docs, history)
    except Exception as exc:  # noqa: BLE001
        log.exception("pipeline failed")
        raise HTTPException(status_code=502, detail=f"assistant run failed: {exc}") from exc

    store.record_triage(session_id, patient_id, triage, trace_id)
    assessment_id = store.save_assessment(session_id, patient_id, req.message, triage, assessment, trace_id, latency_ms)
    store.append_turns(session_id, req.message, assessment.patient_summary)

    if triage.is_emergency:
        settings = get_settings()
        settings_ref = (
            f"Call {settings.emergency_ambulance} for an ambulance. "
            f"{settings.emergency_contact_note}"
        )
        if settings_ref not in assessment.next_steps:
            assessment.next_steps.insert(0, settings_ref)

    return AskResponse(
        session_id=session_id,
        assessment_id=assessment_id,
        triage=triage,
        assessment=assessment,
        trace_id=trace_id,
        latency_ms=latency_ms,
        citations=citations,
    )


@router.get("/sessions/{session_id}/history")
async def history(session_id: str) -> dict:
    return {"session_id": session_id, "turns": store.load_history(session_id, limit=50)}


@router.get("/sessions/{session_id}/assessments")
async def assessments(session_id: str) -> dict:
    from db.supabase import get_supabase

    rows = (
        get_supabase()
        .table("assessments")
        .select("id, question, triage_level, is_emergency, confidence, created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {"session_id": session_id, "assessments": rows or []}
