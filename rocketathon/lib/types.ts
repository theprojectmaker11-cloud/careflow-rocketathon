export type TriageLevel = "emergency" | "urgent" | "soon" | "routine" | "self_care";
export type Severity = "info" | "warning" | "critical";
export type Language = "en" | "ur" | "roman-ur";

export interface PatientRef {
  id?: string;
  mrn?: string;
  full_name?: string;
  age?: number | null;
  sex?: "male" | "female" | "other" | null;
  language?: string;
  allergies?: string[];
  chronic?: string[];
  current_meds?: string[];
  is_pregnant?: boolean | null;
  is_breastfeeding?: boolean | null;
  weight_kg?: number | null;
}

export interface TriageScreen {
  level: TriageLevel;
  is_emergency: boolean;
  red_flags: string[];
  immediate_advice: string;
  rationale: string;
  needs_human_review: boolean;
}

export interface ExtractedFinding {
  test_name: string;
  value: string | null;
  unit: string | null;
  reference_range: string | null;
  flag: string | null;
  source_quote: string | null;
}

export interface DocumentRef {
  id: string;
  file_name: string | null;
  doc_type: string | null;
  findings: ExtractedFinding[];
  reported_medications: string[];
  impressions: string[];
  raw_text: string | null;
}

export interface LabInterpretation {
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  status: "normal" | "high" | "low" | "critical_high" | "critical_low" | "unknown";
  significance: string;
  plain_urdu: string | null;
}

export interface PossibleCause {
  name: string;
  status: "confirmed" | "probable" | "possible" | "unlikely";
  reasoning: string;
  confirm_with: string;
}

export interface MedicationSafetyItem {
  medication: string;
  role: "reported_current" | "patient_proposed" | "assistant_considered" | "on_document";
  verdict:
    | "appropriate"
    | "needs_review"
    | "unsafe"
    | "contraindicated"
    | "insufficient_information";
  reasons: string[];
  safer_alternatives: string[];
  must_confirm_with_doctor: boolean;
  pharmacist_question: string | null;
  sources: string[];
}

export interface PatientAssessment {
  patient_summary: string;
  important_symptoms_findings: string;
  test_report_interpretation: string;
  lab_results: LabInterpretation[];
  possible_causes: PossibleCause[];
  medication_safety: MedicationSafetyItem[];
  treatment_guidance: string;
  next_steps: string[];
  warning_signs: string[];
  information_needed: string[];
  confidence: number;
  requires_consultation: boolean;
  disclaimer: string;
}

export interface AskResponse {
  session_id: string;
  assessment_id: string | null;
  triage: TriageScreen;
  assessment: PatientAssessment;
  trace_id: string | null;
  latency_ms: number | null;
  citations: string[];
}

export interface UploadResponse {
  document: DocumentRef;
  trace_id: string | null;
}

/* ------------------------------------------------------------------------ */
/* Client-side persistence                                                    */
/* ------------------------------------------------------------------------ */

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
  response?: AskResponse;
  error?: string;
  pending?: boolean;
  document_ids?: string[];
}

/** A report the user has uploaded, kept for the Reports and Dashboard views. */
export interface StoredDocument {
  id: string;
  file_name: string;
  doc_type: string | null;
  mime: string;
  size_bytes: number;
  uploaded_at: string;
  findings: ExtractedFinding[];
  reported_medications: string[];
  impressions: string[];
}

/** A completed analysis, kept for History and the Dashboard. */
export interface StoredAnalysis {
  id: string;
  created_at: string;
  session_id: string;
  question: string;
  triage: TriageScreen;
  assessment: PatientAssessment;
  document_ids: string[];
  document_names: string[];
}

export interface PatientProfile {
  full_name: string;
  age: number | null;
  sex: "male" | "female" | "other" | null;
  mrn: string;
  weight_kg: number | null;
  is_pregnant: boolean;
  is_breastfeeding: boolean;
  allergies: string[];
  chronic: string[];
  current_meds: string[];
}

export interface CareflowSettings {
  language: Language;
  auto_listen: boolean;
  keep_history: boolean;
}

export interface CareflowState {
  ready: boolean;
  profile: PatientProfile;
  settings: CareflowSettings;
  session_id: string;
  documents: StoredDocument[];
  analyses: StoredAnalysis[];
  turns: ChatTurn[];
}

/* ------------------------------------------------------------------------ */
/* Server shapes                                                            */
/* ------------------------------------------------------------------------ */

export interface PatientSummary extends PatientRef {
  encounters?: { id: string; started_at: string; reason: string }[];
}

export interface LabResultRow {
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  flag: string | null;
  collected_at: string | null;
  status?: LabInterpretation["status"] | null;
}

export interface HealthStatus {
  status: string;
  provider: string;
  models: Record<string, string>;
  database: string;
}
