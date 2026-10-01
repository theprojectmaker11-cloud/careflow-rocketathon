"""Tools the agents can call. Every tool reads from a database table or the
knowledge base, so the model cannot invent a price, a reference range, or a result.

A DB outage must never crash a consultation: the tools degrade to an honest
"I could not verify this" string rather than raising.
"""

from __future__ import annotations

import json
import logging

from agents import function_tool

from aikti.config import get_settings
from db.supabase import get_supabase, maybe_one

log = logging.getLogger(__name__)


def _safe(fn, *args, **kwargs):
    """Run a DB call, returning None instead of raising so the agent can continue."""
    try:
        return fn(*args, **kwargs)
    except Exception as exc:  # noqa: BLE001
        log.warning("tool db call failed: %s", exc)
        return None


# ================================================================ knowledge base
@function_tool
def search_clinical_guideline(query: str) -> str:
    """Search Alkhidmat clinical protocols, national guidelines, and patient-education material.

    Use this to ground any statement about treatment, dosing context, or what to monitor.

    Args:
        query: A clinical question, e.g. "dengue fever home management and warning signs".
    """
    from db import vector

    rows = vector.search_kb(query, match_count=get_settings().rag_match_count)
    if rows is None:
        return json.dumps({"results": [], "unavailable": True})
    return json.dumps(
        {
            "results": [
                {"title": r["title"], "category": r["category"], "excerpt": r["body"][:800], "source": r.get("source")}
                for r in rows
            ]
        }
    )


@function_tool
def search_emergency_protocol(query: str) -> str:
    """Search emergency and red-flag protocols. Use before deciding the urgency level
    whenever a report is attached or a symptom sounds acute.

    Args:
        query: The symptom, finding, or test value to check.
    """
    from db import vector

    rows = vector.search_kb(query, category="emergency", match_count=4)
    if not rows:
        rows = vector.search_kb(query, category="protocol", match_count=3)
    if rows is None:
        return json.dumps({"results": [], "unavailable": True})
    return json.dumps(
        {"results": [{"title": r["title"], "excerpt": r["body"][:800], "source": r.get("source")} for r in rows]}
    )


# ================================================================ formulary
@function_tool
def lookup_formulary(drug_query: str) -> str:
    """Check the Alkhidmat subsidised pharmacy formulary for a drug.

    Use this to give the patient a generic name to ask a pharmacist about, and to tell
    them whether the medicine they need is stocked and at what price. Never present this
    as a prescription or recommend they self-administer.

    Args:
        drug_query: Brand name, generic name, or the drug class as the patient said it.
    """
    from db import vector

    hits = vector.search_formulary(drug_query)
    if hits is None:
        return json.dumps({"found": False, "unavailable": True})
    if not hits:
        return json.dumps({"found": False, "query": drug_query, "options": []})
    return json.dumps({"found": True, "query": drug_query, "options": [h.model_dump() for h in hits]})


# ================================================================ patient
@function_tool
def get_patient_summary(patient_id: str) -> str:
    """Load a patient's demographics, allergies, chronic conditions, current medicines,
    all uploaded documents and their last lab results.

    Call this whenever a patient id is available before making any safety judgement.

    Args:
        patient_id: Supabase patient uuid.
    """
    supabase = get_supabase()
    patient = _safe(lambda: maybe_one(supabase.table("patients").select("*").eq("id", patient_id)))
    if not patient:
        return json.dumps({"found": False, "patient_id": patient_id})
    results = _safe(lambda: supabase.table("lab_results").select("*").eq("patient_id", patient_id).order("created_at", desc=True).limit(20).execute().data) or []
    docs = _safe(lambda: supabase.table("documents").select("id, file_name, doc_type, created_at").eq("patient_id", patient_id).order("created_at", desc=True).limit(10).execute().data) or []
    return json.dumps({"found": True, "patient": patient, "recent_lab_results": results, "documents": docs})


@function_tool
def check_drug_interaction(drug: str, other_drug: str, patient_context: str = "") -> str:
    """Check whether two drugs interact, and how serious it is.

    Args:
        drug: The drug being added or proposed.
        other_drug: A drug the patient is already taking.
        patient_context: Age, weight, pregnancy, kidney or liver status, allergies.
    """
    from db import vector

    query = f"drug interaction {drug} with {other_drug} {patient_context} severity management contraindication"
    rows = vector.search_kb(query, category="guideline", match_count=4) or []
    return json.dumps(
        {
            "pair": [drug, other_drug],
            "found": bool(rows),
            "evidence": [{"title": r["title"], "excerpt": r["body"][:600], "source": r.get("source")} for r in rows],
        }
    )


# ================================================================ lab values
@function_tool
def get_reference_range(test_name: str, age: int | None = None, sex: str | None = None) -> str:
    """Look up the normal and critical reference range for a laboratory test.

    Use this before saying a number is normal, high, low, or critical. If the range is
    unknown, say so rather than guessing.

    Args:
        test_name: The test as printed on the report, e.g. "Serum Potassium" or "Hb".
        age: Patient age in years, if known.
        sex: male or female, if known.
    """
    from db import vector

    supabase = get_supabase()
    rows = _safe(
        lambda: supabase.table("reference_ranges")
        .select("*")
        .ilike("test_name", f"%{test_name}%")
        .limit(8)
        .execute().data
    )
    if rows is None:
        return json.dumps({"found": False, "unavailable": True})
    if not rows:
        vector_rows = vector.search_kb(f"reference range normal values for {test_name}", category="reference_ranges", match_count=2) or []
        return json.dumps({"found": False, "test_name": test_name, "kb_fallback": vector_rows})
    if age is not None:
        narrowed = [r for r in rows if (r.get("age_low") is None or r["age_low"] <= age) and (r.get("age_high") is None or r["age_high"] >= age)]
        if narrowed:
            rows = narrowed
    if sex:
        matched = [r for r in rows if r.get("sex") == sex] or [r for r in rows if r.get("sex") is None]
        rows = matched
    return json.dumps(
        {
            "found": True,
            "test_name": test_name,
            "ranges": [
                {
                    "test_name": r["test_name"],
                    "unit": r.get("unit"),
                    "normal_low": r.get("normal_low"),
                    "normal_high": r.get("normal_high"),
                    "critical_low": r.get("critical_low"),
                    "critical_high": r.get("critical_high"),
                    "note": r.get("note"),
                }
                for r in rows[:3]
            ],
        }
    )


# ================================================================ write-back
@function_tool
def escalate_to_emergency(patient_id: str, session_id: str, red_flags: str, advice: str) -> str:
    """Record that this patient was flagged for emergency care, so staff are alerted and
    the event is auditable. Call this only when urgent care is genuinely required.

    Args:
        patient_id: Supabase patient uuid, or "unknown".
        session_id: The current chat session uuid, or "unknown".
        red_flags: The findings that triggered the escalation, separated by semicolons.
        advice: The immediate advice given to the patient.
    """
    supabase = get_supabase()
    pid = None if patient_id in ("unknown", "", None) else patient_id
    sid = None if session_id in ("unknown", "", None) else session_id
    _safe(
        lambda: supabase.table("triage_events").insert(
            {
                "session_id": sid,
                "patient_id": pid,
                "level": "emergency",
                "is_emergency": True,
                "red_flags": [f.strip() for f in red_flags.split(";") if f.strip()],
                "advice": advice,
            }
        ).execute()
    )
    return json.dumps({"escalated": True})


ALL_TOOLS = [
    search_clinical_guideline,
    search_emergency_protocol,
    lookup_formulary,
    get_patient_summary,
    check_drug_interaction,
    get_reference_range,
    escalate_to_emergency,
]
