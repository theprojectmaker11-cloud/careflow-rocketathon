"""Reference data: formulary search, patient records, lab history."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query

from aikti.models import FormularyHit, LabRecord, PatientRecord
from db import vector
from db.supabase import get_supabase, maybe_one

router = APIRouter(prefix="/api", tags=["reference"])


def _resolve_patient(identifier: str) -> dict:
    """Look a patient up by primary key or by MRN.

    The web client addresses patients by MRN, but `patients.id` and
    `lab_results.patient_id` are uuids, so filtering those columns with
    "MRN-0001" raised a 22P02 cast error. Anything that parses as a uuid is
    treated as the id, everything else as the MRN.
    """
    query = get_supabase().table("patients").select("*")
    try:
        uuid.UUID(identifier)
    except (ValueError, AttributeError, TypeError):
        query = query.eq("mrn", identifier)
    else:
        query = query.eq("id", identifier)
    row = maybe_one(query)
    if not row:
        raise HTTPException(status_code=404, detail="patient not found")
    return row


@router.get("/formulary/search")
async def search_formulary(q: str = Query(min_length=2), limit: int = 6) -> dict:
    """Availability and price only. Never returns dosing."""
    hits = vector.search_formulary(q, match_count=limit)
    return {"query": q, "results": [h.model_dump() for h in hits]}


@router.get("/patients/{patient_id}", response_model=PatientRecord)
async def get_patient(patient_id: str) -> PatientRecord:
    row = _resolve_patient(patient_id)
    return PatientRecord(**{k: row.get(k) for k in PatientRecord.model_fields if k in row})


@router.get("/patients/{patient_id}/labs", response_model=list[LabRecord])
async def get_patient_labs(patient_id: str, limit: int = 50) -> list[LabRecord]:
    # Resolve first: lab_results.patient_id is a uuid even when the client asked
    # by MRN.
    row = _resolve_patient(patient_id)
    rows = (
        get_supabase()
        .table("lab_results")
        .select("*")
        .eq("patient_id", row["id"])
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
    return [LabRecord(**{k: r.get(k) for k in LabRecord.model_fields if k in r}) for r in rows]


@router.get("/reference-ranges/{test_name}")
async def get_reference_range(test_name: str) -> dict:
    rows = (
        get_supabase()
        .table("reference_ranges")
        .select("*")
        .ilike("test_name", f"%{test_name}%")
        .limit(5)
        .execute()
        .data
        or []
    )
    return {"test_name": test_name, "ranges": rows}
