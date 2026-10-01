"""Document upload: vision extraction, then storage for later turns to re-read."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from aikti.models import DocumentRef, PatientRef, UploadResponse
from db import persistence as store
from med_agents.assistant import run_document_extraction
from med_agents.pdf import PdfUnreadableError

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_BYTES = 12 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"}


@router.post("", response_model=UploadResponse)
async def upload(
    file: UploadFile = File(...),
    patient_mrn: str | None = Form(default=None),
    patient_age: int | None = Form(default=None),
) -> UploadResponse:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file larger than 12 MB")
    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED:
        raise HTTPException(status_code=415, detail=f"unsupported file type {mime}; upload an image or PDF")

    patient_id = None
    if patient_mrn or patient_age is not None:
        patient_id = store.upsert_patient(PatientRef(mrn=patient_mrn, age=patient_age))

    try:
        extraction, trace_id = await run_document_extraction(file.filename or "upload", data, mime)
    except PdfUnreadableError as exc:
        # A corrupt, encrypted or non-PDF file is the client's problem, not ours.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        log.exception("document extraction failed")
        raise HTTPException(status_code=502, detail=f"could not read the document: {exc}") from exc

    if extraction.illegible or not extraction.raw_text:
        raise HTTPException(
            status_code=422,
            detail="the document could not be read. try a clearer photo, in good light, with the whole page in frame",
        )

    doc_id = store.save_document(patient_id, file.filename or "upload", mime, None, extraction)
    if not doc_id:
        raise HTTPException(status_code=503, detail="document read successfully but could not be saved")

    return UploadResponse(
        document=DocumentRef(
            id=doc_id,
            file_name=file.filename,
            doc_type=extraction.doc_type,
            findings=extraction.findings,
            reported_medications=extraction.reported_medications,
            impressions=extraction.impressions,
            raw_text=extraction.raw_text,
        ),
        trace_id=trace_id,
    )


@router.get("/{document_id}")
async def get_document(document_id: str) -> dict:
    from db.supabase import get_supabase, maybe_one

    row = maybe_one(get_supabase().table("documents").select("*").eq("id", document_id))
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row
