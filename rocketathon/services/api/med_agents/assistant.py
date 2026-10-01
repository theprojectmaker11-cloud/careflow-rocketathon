"""The assistant orchestrator: the entry agent, plus the safety-first pipeline.

Pipeline for every patient turn:

    1. Red Flag Agent      -> TriageScreen   (always runs, gates everything)
    2. if is_emergency     -> emergency path, no differential, no treatment advice
       else                -> Assistant Agent -> PatientAssessment
                                ├── handoff -> Medication Safety Agent
                                └── handoff -> Formulary Agent
    3. record triage + assessment, store chat turns in Mongo
"""

from __future__ import annotations

import json
import logging
import time

from agents import Agent, ModelSettings, RunConfig, Runner, handoff
from agents.exceptions import ModelBehaviorError, ModelRefusalError

from aikti.config import get_settings
from aikti.llm import assistant_model
from aikti.models import (
    AskRequest,
    DocumentExtraction,
    DocumentRef,
    HandoffRequest,
    PatientAssessment,
    TriageScreen,
)
from aikti.tracing import new_trace_id
from med_agents.formulary import build_formulary_agent
from med_agents.medication_safety import build_medication_safety_agent
from med_agents.tools import get_patient_summary, get_reference_range, search_clinical_guideline
from med_agents.triage import build_triage_agent

log = logging.getLogger(__name__)

INSTRUCTIONS = """You are a patient-facing medical decision-support assistant. Patients reach you
because they are worried, they cannot read or afford a clinic visit, or they have a lab
report they do not understand. Many speak Urdu or Roman-Urdu. Some are very poor, very
young, or very old.

You are NOT a doctor and you do not act like one. You explain, you organise, and you tell
the patient exactly what to ask a real clinician. You never diagnose as fact and you
never write a prescription or a dose.

## What you do, in order

**1. Patient Summary.** Two or three sentences: who they are, what they are worried about,
what they have already been told. Use only what they told you. Mark anything unstated as
not reported. Never invent an age, a history, or a test.

**2. Important Symptoms & Findings.** Every symptom with its duration, severity, and
triggers. Call out what is clinically notable: fever, night sweats, weight loss, bleeding,
pain waking them at night, symptoms that are new or changing. If they said something vague
like "blood pressure kharaab hai", write exactly that and put the actual number in
`information_needed`, because you cannot interpret it without a value.

**3. Test Report Interpretation.** If a report is attached, read every value out loud in
plain language and say what it means for this patient. Call `get_reference_range` before
saying any number is high, low, or critical — never judge a number against a range you
remember. If no report was attached, say so plainly and tell them what to bring or ask for.
Never state a test result that is not in the input.

**4. Possible Causes / Conditions.** Only when the information actually supports it. For
each: a name, whether it is confirmed, probable, or merely possible, the reasoning tied to
*this* patient's symptoms and results, and the specific test or examination that would settle
it. Order them most to least likely. If the information is too thin, return an empty list
and say so — a short honest list beats a long speculative one. Never write a diagnosis as
established fact. A possible cause is not a diagnosis.

**5. Medication & Treatment Safety Check.** Delegate to the Medication Safety Agent for
every single medicine: what they take, what they stopped, what they want to start. Keep
every finding it returns, including the ones you would rather soften. If the patient is
taking something that is unsafe for them, this section says so in the first line, before
anything else in the section. Never recommend a medicine because it is commonly used.
Never name a dose.

**6. Treatment Guidance.** General self-care: what helps, what to avoid, what to monitor,
how long to try before seeking care. Say plainly which things to discuss with a doctor.
Do not present this as a prescription. If they need medicine, name the drug class or the
generic as something to ask about, then tell them to confirm with a doctor or pharmacist.

**7. Recommended Next Steps.** Ordered and concrete. Which type of doctor, what to bring,
which test to request, what to say. If Alkhidmat subsidised care is relevant, mention that
essential chronic medicines, labs and free clinics exist. Respect cost: if something is
unlikely to change what they should do, do not send them to buy it.

**8. Warning Signs / When to Seek Urgent Care.** What to watch for after they go home and
what to do about it. Be specific: which symptom, and go to which place. If the Red Flag
Agent found an emergency, this section leads with it.

**9. Questions or Information Still Needed.** The specific questions that would sharpen
the answer, phrased so the patient can answer them right now. Age, duration, exact values,
what they already took, pregnancy, breastfeeding, other conditions. If a missing detail
would change the urgency, say that in the question.

## Rules that never bend

- Never fabricate a test result, a diagnosis, a medicine, a dose, or part of a history.
  If it is not in the input, it does not exist. Write "not reported" or "not documented".
- Never claim certainty you do not have. Use "could be", "is consistent with", "needs to
  be checked" when that is what you mean. Say "confirmed" only for something a test or
  examination already established.
- Never recommend a treatment when the information is insufficient to do it safely. Say
  what is missing instead. An incomplete answer is better than a confident wrong one.
- Never lower urgency because the patient seems calm, because the symptom has lasted a
  while, or because they cannot pay. Cost is not a clinical factor.
- When a child is involved, describe doses and thresholds relative to weight, and say the
  weight is needed. Never calculate a child's dose from age alone.
- Write in the language the patient is writing in. If they write Roman-Urdu, answer in
  Roman-Urdu. Simple words. Explain any term you must use.
- End every response by making it clear this is information to discuss with a qualified
  doctor or pharmacist, not a diagnosis or a prescription.
"""


# ================================================================ agent builders
async def _on_medication_handoff(_ctx, inp: HandoffRequest) -> None:
    """Records what the assistant asked the safety agent to review."""
    log.info("medication safety handoff: %s", (inp.reason or "")[:200])


async def _on_pharmacy_handoff(_ctx, inp: HandoffRequest) -> None:
    """Records the stock/affordability question the assistant forwarded."""
    log.info("pharmacy handoff: %s %s", inp.medicines, (inp.reason or "")[:160])


def build_assistant_agent() -> Agent:
    return Agent(
        name="Medical Assistant",
        instructions=INSTRUCTIONS,
        model=assistant_model(),
        tools=[get_patient_summary, get_reference_range, search_clinical_guideline],
        handoffs=[
            handoff(
                agent=build_medication_safety_agent(),
                tool_name_override="check_medication_safety",
                tool_description_override="Run a full safety review on every medication the patient takes, stopped, or wants to start.",
                input_type=HandoffRequest,
                on_handoff=_on_medication_handoff,
            ),
            handoff(
                agent=build_formulary_agent(),
                tool_name_override="ask_pharmacy",
                tool_description_override="Check whether a medicine is stocked at the subsidised Alkhidmat pharmacy, and give the patient a generic name to ask the pharmacist about.",
                input_type=HandoffRequest,
                on_handoff=_on_pharmacy_handoff,
            ),
        ],
        output_type=PatientAssessment,
    )


# ================================================================ prompt assembly
def _patient_block(req: AskRequest) -> str:
    p = req.patient
    if not p:
        return "PATIENT PROFILE: not provided. Treat age, sex, allergies, pregnancy status, and current medicines as UNKNOWN and ask for them."
    flags = []
    if p.is_pregnant:
        flags.append("PREGNANT")
    if p.is_breastfeeding:
        flags.append("BREASTFEEDING")
    head = f"PATIENT PROFILE: {p.full_name or 'name not given'}, age {p.age if p.age is not None else 'not stated'}, sex {p.sex or 'not stated'}"
    if p.weight_kg:
        head += f", weight {p.weight_kg} kg"
    head += f", language {p.language}"
    if flags:
        head += f" [{', '.join(flags)}]"
    return (
        f"{head}\n"
        f"  allergies: {', '.join(p.allergies) if p.allergies else 'none reported'}\n"
        f"  existing conditions: {', '.join(p.chronic) if p.chronic else 'none reported'}\n"
        f"  current medicines: {', '.join(p.current_meds) if p.current_meds else 'none reported'}"
    )


def _documents_block(docs: list[DocumentRef]) -> str:
    if not docs:
        return "ATTACHED DOCUMENTS: none. Say so in the Test Report Interpretation section."
    out = [f"ATTACHED DOCUMENTS ({len(docs)}), transcribed verbatim by the Document Reader Agent:"]
    for d in docs:
        out.append(f"\n--- {d.file_name or d.id} [{d.doc_type or 'unknown type'}] ---")
        if d.impressions:
            out.append("IMPRESSION: " + "; ".join(d.impressions))
        if d.findings:
            out.append("TESTS:")
            for f in d.findings:
                line = f"  - {f.test_name}: {f.value or 'value not legible'}"
                if f.unit:
                    line += f" {f.unit}"
                if f.reference_range:
                    line += f" (report reference range: {f.reference_range})"
                if f.flag:
                    line += f" [report flag: {f.flag}]"
                out.append(line)
        if d.reported_medications:
            out.append("MEDICATIONS ON DOCUMENT: " + ", ".join(d.reported_medications))
        if d.raw_text:
            out.append(f"RAW TRANSCRIPT:\n{d.raw_text[:6000]}")
    return "\n".join(out)


def _history_block(history: list[dict], limit: int = 6) -> str:
    if not history:
        return ""
    lines = ["EARLIER IN THIS CONVERSATION (for continuity, do not repeat):"]
    for turn in history[-limit:]:
        lines.append(f"  [{turn.get('role')}] {str(turn.get('content'))[:600]}")
    return "\n".join(lines)


def build_assistant_prompt(req: AskRequest, docs: list[DocumentRef], history: list[dict], triage: TriageScreen) -> str:
    return "\n\n".join(
        part
        for part in [
            "=== PATIENT MESSAGE ===\n" + req.message,
            _patient_block(req),
            _documents_block(docs),
            f"SAFETY SCREEN COMPLETED BY THE RED FLAG AGENT (do not re-litigate, but do not soften):\n"
            f"  urgency: {triage.level}\n  red flags: {'; '.join(triage.red_flags) or 'none'}\n"
            f"  rationale: {triage.rationale}",
            _history_block(history),
            "=== NOW ANSWER, FILLING ALL NINE SECTIONS ===",
        ]
        if part
    )


# ================================================================ pipeline
RETRY_NOTE = """
IMPORTANT: your previous reply could not be parsed as the required JSON object.
Reply again with ONLY a single valid JSON object matching the required schema.
No prose before or after it. No markdown code fence. Every required field present.
"""


def _run_config(workflow_name: str, trace_metadata: dict) -> RunConfig:
    """Builds the shared RunConfig, capping output tokens so OpenRouter's credit
    pre-authorisation does not reject the request before it reaches the model."""
    return RunConfig(
        workflow_name=workflow_name,
        trace_metadata=trace_metadata,
        model_settings=ModelSettings(max_tokens=get_settings().model_max_tokens),
    )


async def _run_structured(agent: Agent, prompt: str, max_turns: int, run_config: RunConfig):
    """Run an agent, retrying once if the reply will not parse as the output schema.

    Google's OpenAI-compatible endpoint honours `response_format: json_schema`, but
    strict-mode adherence is looser than OpenAI's own. A malformed reply must never
    reach a patient, so we retry once with an explicit instruction and then fail
    loudly to a 502 rather than returning anything unvalidated.
    """
    from agents.exceptions import ModelBehaviorError, ModelRefusalError

    try:
        return await Runner.run(agent, prompt, max_turns=max_turns, run_config=run_config)
    except (ModelBehaviorError, ModelRefusalError) as exc:
        log.warning("structured output unusable (%s), retrying once", type(exc).__name__)
        result = await Runner.run(
            agent, prompt + RETRY_NOTE, max_turns=max_turns, run_config=run_config
        )
        return result


async def run_triage(req: AskRequest, docs: list[DocumentRef]) -> tuple[TriageScreen, str | None]:
    triage_input = "\n\n".join(
        [
            "PATIENT MESSAGE:\n" + req.message,
            _patient_block(req),
            _documents_block(docs),
        ]
    )
    trace_id = new_trace_id()
    result = await _run_structured(
        build_triage_agent(),
        triage_input,
        max_turns=8,
        run_config=_run_config(
            "aikti_triage",
            {"stage": "triage", "trace_id": trace_id},
        ),
    )
    return result.final_output_as(TriageScreen), trace_id


EMERGENCY_ASSESSMENT = PatientAssessment(
    patient_summary="Your message contains warning signs that need a doctor right now.",
    important_symptoms_findings="",
    test_report_interpretation="",
    possible_causes=[],
    medication_safety=[],
    treatment_guidance="Do not wait for an online answer. Go to the nearest emergency department now, or call an ambulance.",
    next_steps=[
        "Go to the nearest hospital emergency department immediately, or call an ambulance.",
        "Do not drive yourself if you feel faint, confused, or short of breath.",
        "Bring any medicine packets and reports you already have with you.",
        "Tell the doctor when the symptom started and whether it is getting worse.",
    ],
    warning_signs=[],
    information_needed=[],
    confidence=0.2,
    requires_consultation=True,
)


async def run_assessment(
    req: AskRequest,
    docs: list[DocumentRef],
    history: list[dict],
    triage: TriageScreen,
) -> tuple[PatientAssessment, str | None]:
    """Runs the full reasoning pipeline. Short-circuits on a red-flag emergency."""
    if triage.is_emergency or triage.level == "emergency":
        log.warning("emergency short-circuit: %s", triage.red_flags)
        return EMERGENCY_ASSESSMENT.model_copy(update={"warning_signs": triage.red_flags})

    trace_id = new_trace_id()
    result = await _run_structured(
        build_assistant_agent(),
        build_assistant_prompt(req, docs, history, triage),
        max_turns=24,
        run_config=_run_config(
            "aikti_consultation",
            {
                "stage": "assessment",
                "language": req.language,
                "docs": len(docs),
                "trace_id": trace_id,
            },
        ),
    )
    return _as_assessment(result.final_output), trace_id


async def run_document_extraction(file_name: str, data: bytes, mime_type: str | None = None):
    from med_agents.documents import agent_context, build_document_agent, build_document_content

    # A PDF becomes one image part per page; an image stays a single part.
    parts = build_document_content(file_name, data, mime_type)
    trace_id = new_trace_id()
    result = await _run_structured(
        build_document_agent(),
        [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": agent_context(file_name, len(parts))},
                    *parts,
                ],
            }
        ],
        max_turns=5,
        run_config=_run_config(
            "aikti_document",
            {"stage": "document", "trace_id": trace_id},
        ),
    )
    return result.final_output_as(DocumentExtraction), trace_id


async def run_full_pipeline(req: AskRequest, docs: list[DocumentRef], history: list[dict]):
    started = time.perf_counter()
    triage, triage_trace = await run_triage(req, docs)
    assessment, assessment_trace = await run_assessment(req, docs, history, triage)
    citations = _citations(assessment, docs)
    return triage, assessment, triage_trace or assessment_trace, int((time.perf_counter() - started) * 1000), citations


def _as_assessment(raw) -> PatientAssessment:
    """Coerce the model's structured output into a PatientAssessment.

    The schema-constrained endpoint occasionally replies with a single-element JSON
    array instead of the object the schema asks for. Unwrap that rather than letting
    a list reach the citation builder or the patient-facing renderer.
    """
    if isinstance(raw, PatientAssessment):
        return raw
    if isinstance(raw, list):
        raw = next((item for item in raw if isinstance(item, dict)), None)
        if raw is None:
            raise ModelBehaviorError("empty assessment payload")
    if isinstance(raw, dict):
        return PatientAssessment.model_validate(raw)
    raise ModelBehaviorError(f"unexpected assessment type: {type(raw).__name__}")


def _citations(assessment: PatientAssessment, docs: list[DocumentRef]) -> list[str]:
    cites = [f"attachment: {d.file_name or d.id}" for d in docs]
    for item in getattr(assessment, "medication_safety", []) or []:
        cites.extend(item.sources or [])
    return list(dict.fromkeys(cites))
