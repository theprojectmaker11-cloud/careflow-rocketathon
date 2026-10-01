"""Pydantic schemas: structured output contracts for the medical assistant agents.

Every agent output is schema-constrained so the model cannot invent a free-form
field, and so the frontend can render the eight required sections deterministically.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# ------------------------------------------------------------------ shared types
TriageLevel = Literal["emergency", "urgent", "soon", "routine", "self_care"]
Severity = Literal["info", "warning", "critical"]
Language = Literal["en", "ur", "roman-ur"]


# ================================================================ triage
class TriageScreen(BaseModel):
    """Output of the red-flag agent. Runs before anything else in the pipeline."""

    level: TriageLevel = Field(description="emergency = life threatening, urgent = same day, soon = this week, routine = next visit, self_care = home management")
    is_emergency: bool = False
    red_flags: list[str] = Field(default_factory=list, description="Specific findings that drove the level, quoted from the input")
    immediate_advice: str = Field(default="", description="What the patient must do right now, first sentence, in plain language")
    rationale: str = Field(default="", description="One or two sentences on why this level was chosen")
    needs_human_review: bool = True


# ================================================================ documents
class ExtractedFinding(BaseModel):
    test_name: str
    value: str | None = None
    unit: str | None = None
    reference_range: str | None = None
    flag: str | None = Field(default=None, description="H / L / HIGH / LOW / CRITICAL as printed on the report, or null")
    source_quote: str | None = Field(default=None, description="The exact line from the document this came from")


class DocumentExtraction(BaseModel):
    doc_type: Literal["lab_report", "imaging_report", "prescription", "discharge_summary", "medical_record", "unknown"]
    raw_text: str = Field(default="", description="Full transcription of the document. Empty string if illegible.")
    findings: list[ExtractedFinding] = Field(default_factory=list, description="Every test and its value, for lab reports")
    reported_medications: list[str] = Field(default_factory=list, description="Every medication named on the document, verbatim")
    allergies: list[str] = Field(
        default_factory=list,
        description="Every allergy, intolerance or reaction the document states about the patient, verbatim. Empty when the document mentions none.",
    )
    impressions: list[str] = Field(default_factory=list, description="Impression or conclusion lines, for imaging reports")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Legibility. 0 if the document could not be read at all.")
    illegible: bool = False


# ================================================================ lab interpretation
class LabInterpretation(BaseModel):
    test_name: str
    value: str
    unit: str | None = None
    reference_range: str | None = None
    status: Literal["normal", "high", "low", "critical_high", "critical_low", "unknown"]
    significance: str = Field(description="What this result means for this patient, or why it does not")
    plain_urdu: str | None = Field(default=None, description="One short sentence a patient with no medical training understands")


# ================================================================ clinical reasoning
class PossibleCause(BaseModel):
    name: str
    status: Literal["confirmed", "probable", "possible", "unlikely"]
    reasoning: str = Field(description="Tied to the patient's own symptoms and results, not a generic list")
    confirm_with: str = Field(description="The specific test, examination or observation that would confirm or exclude it")


class MedicationSafetyItem(BaseModel):
    medication: str
    role: Literal["reported_current", "patient_proposed", "assistant_considered", "on_document"]
    verdict: Literal["appropriate", "needs_review", "unsafe", "contraindicated", "insufficient_information"]
    reasons: list[str] = Field(default_factory=list, description="Allergies, interactions, contraindications, duplicate therapy, organ function")
    safer_alternatives: list[str] = Field(default_factory=list, description="Generic name or drug class only. Never a dose.")
    must_confirm_with_doctor: bool = True
    pharmacist_question: str | None = Field(default=None, description="The exact question to ask the doctor or pharmacist")
    sources: list[str] = Field(default_factory=list, description="Titles of the guidelines or protocols this verdict came from")


class HandoffRequest(BaseModel):
    """Input for a specialist-agent handoff.

    Declaring an explicit schema keeps the generated tool parameters valid on
    providers that reject a `required` list without a matching `properties` block.
    """

    reason: str = Field(
        default="",
        description="Why this specialist is needed and what the patient reported that prompts it.",
    )
    medicines: list[str] = Field(
        default_factory=list,
        description="Medication names or brands this handoff concerns, as the patient stated them.",
    )


# ================================================================ the eight required sections
class PatientAssessment(BaseModel):
    """The complete patient-facing answer. Sections map 1:1 to the required format."""

    patient_summary: str = Field(description="2-3 sentences: who the patient is, in what language, what they are worried about. Echoes only what they told you.")
    important_symptoms_findings: str = Field(description="Symptoms with duration, severity, and anything clinically notable. Mark anything not stated as 'not reported'.")
    test_report_interpretation: str = Field(description="Plain language reading of every uploaded result. Say plainly if no report was provided.")
    lab_results: list[LabInterpretation] = Field(default_factory=list)
    possible_causes: list[PossibleCause] = Field(default_factory=list, description="Empty if information is insufficient. Ordered most to least likely.")
    medication_safety: list[MedicationSafetyItem] = Field(default_factory=list, description="Every medication the patient is on, or is proposing to take. Empty if none were mentioned.")
    treatment_guidance: str = Field(description="General self-care and what to discuss with a doctor. Never a definitive prescription or dose.")
    next_steps: list[str] = Field(default_factory=list, description="Concrete, ordered, actionable. Include which type of doctor and what to bring.")
    warning_signs: list[str] = Field(default_factory=list, description="What to watch for, and what to do about it. Empty only if genuinely nothing.")
    information_needed: list[str] = Field(default_factory=list, description="Specific missing details, phrased as questions the patient can answer.")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="How well the input supports the conclusions above")
    requires_consultation: bool = Field(default=True, description="Always true unless purely administrative self-care advice")
    disclaimer: str = Field(
        default="This is decision-support information, not a diagnosis. Confirm any medicine or dose with a qualified doctor or pharmacist.",
    )


# ================================================================ api envelopes
class PatientRef(BaseModel):
    id: str | None = None
    mrn: str | None = None
    full_name: str | None = None
    age: int | None = None
    sex: str | None = None
    language: str = "en"
    allergies: list[str] = Field(default_factory=list)
    chronic: list[str] = Field(default_factory=list)
    current_meds: list[str] = Field(default_factory=list)
    is_pregnant: bool | None = None
    is_breastfeeding: bool | None = None
    weight_kg: float | None = None


class DocumentRef(BaseModel):
    id: str
    file_name: str | None = None
    doc_type: str | None = None
    findings: list[ExtractedFinding] = Field(default_factory=list)
    reported_medications: list[str] = Field(default_factory=list)
    impressions: list[str] = Field(default_factory=list)
    raw_text: str | None = None


class AskRequest(BaseModel):
    message: str = Field(min_length=1, description="What the patient typed or said, verbatim")
    patient: PatientRef | None = None
    document_ids: list[str] = Field(default_factory=list)
    language: Language = "en"
    session_id: str | None = None
    include_urdu_summary: bool = True


class AskResponse(BaseModel):
    session_id: str
    assessment_id: str | None = None
    triage: TriageScreen
    assessment: PatientAssessment
    trace_id: str | None = None
    latency_ms: int | None = None
    citations: list[str] = Field(default_factory=list)


class UploadResponse(BaseModel):
    document: DocumentRef
    trace_id: str | None = None


# ================================================================ records (reused by reference router)
class PatientRecord(BaseModel):
    id: str
    mrn: str
    full_name: str
    age: int | None = None
    sex: str | None = None
    allergies: list[str] = []
    chronic: list[str] = []
    current_meds: list[str] = []


class LabRecord(BaseModel):
    id: str
    test_name: str
    value_raw: str | None = None
    unit: str | None = None
    ref_range: str | None = None
    status: str | None = None
    plain_urdu: str | None = None
    created_at: datetime | None = None


class FormularyHit(BaseModel):
    brand_name: str
    generic_name: str
    strength: str
    form: str
    unit_price_pkr: float
    in_stock: bool
    similarity: float | None = None
