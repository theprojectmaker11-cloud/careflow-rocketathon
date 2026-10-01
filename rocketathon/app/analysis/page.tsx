"use client";

/**
 * Health analysis: a five-step flow rather than one long form.
 *
 *   Patient details → Symptoms → Reports → Review → Analysis
 *
 * The review step exists so the user always sees exactly what is being sent,
 * which matters when the content is medical. Results render as a structured
 * document, not a chat message.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "../../components/icons";
import { ProgressSteps } from "../../components/interactive";
import { AnalysisLoading, AnalysisSkeleton } from "../../components/AnalysisLoading";
import { ResultPanel } from "../../components/ResultPanel";
import { UploadPanel } from "../../components/UploadPanel";
import { useCareflow } from "../../components/CareflowProvider";
import {
  Alert,
  Button,
  Card,
  Disclaimer,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  cx,
} from "../../components/ui";
import { askAssistant } from "../../lib/api";
import { LANGUAGES, STARTERS } from "../../lib/format";
import type { AskResponse, StoredAnalysis } from "../../lib/types";

const STEPS = [
  { key: "details", label: "Patient details", hint: "Optional but improves accuracy" },
  { key: "symptoms", label: "Symptoms", hint: "What is happening" },
  { key: "reports", label: "Reports", hint: "Upload test results" },
  { key: "review", label: "Review", hint: "Check before sending" },
  { key: "result", label: "Analysis", hint: "Your summary" },
];

type Step = 0 | 1 | 2 | 3 | 4;

/** Supports dashboard deep links such as /analysis?step=reports. */
function initialStep(param: string | null): Step {
  if (param === "reports") return 2;
  if (param === "symptoms") return 1;
  return 0;
}

/** Fallback id when the API did not persist an assessment. */
function newLocalId(sessionId: string): string {
  return `${sessionId}-${Date.now().toString(36)}`;
}

export default function AnalysisPage() {
  // useSearchParams() opts the page out of static prerendering unless it sits
  // behind a Suspense boundary, so the shell is prerendered and the flow streams in.
  return (
    <Suspense fallback={<AnalysisSkeleton />}>
      <AnalysisFlow />
    </Suspense>
  );
}

function AnalysisFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, updateProfile, updateSettings, addAnalysis, setSessionId } = useCareflow();

  const [step, setStep] = useState<Step>(() => initialStep(params.get("step")));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [localDocs, setLocalDocs] = useState<string[]>([]);

  const profile = state.profile;
  const documents = state.documents;


  const selectedIds = useMemo(
    () => Array.from(new Set([...localDocs, ...documents.map((d) => d.id)])),
    [localDocs, documents],
  );
  const attachedDocs = documents.filter((d) => selectedIds.includes(d.id));

  const symptomsLongEnough = message.trim().length >= 12;

  function canAdvance(next: Step): boolean {
    if (next === 1) return true;
    if (next === 2) return true;
    if (next === 3) return true;
    if (next === 4) return symptomsLongEnough;
    return true;
  }

  function go(next: Step) {
    if (next > step && !canAdvance(next)) return;
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!symptomsLongEnough || busy) return;
    setBusy(true);
    setError(null);
    setStep(4);

    try {
      const res = await askAssistant({
        message: message.trim(),
        language: state.settings.language,
        session_id: state.session_id || null,
        document_ids: attachedDocs.map((d) => d.id),
        patient: {
          full_name: profile.full_name || null,
          age: profile.age,
          sex: profile.sex,
          mrn: profile.mrn || null,
          weight_kg: profile.weight_kg,
          is_pregnant: profile.is_pregnant || null,
          is_breastfeeding: profile.is_breastfeeding || null,
          allergies: profile.allergies,
          chronic: profile.chronic,
          current_meds: profile.current_meds,
        },
      });

      if (res.session_id) setSessionId(res.session_id);
      setResult(res);

      const entry: StoredAnalysis = {
        id: res.assessment_id ?? newLocalId(res.session_id),
        created_at: new Date().toISOString(),
        session_id: res.session_id,
        question: message.trim(),
        triage: res.triage,
        assessment: res.assessment,
        document_ids: attachedDocs.map((d) => d.id),
        document_names: attachedDocs.map((d) => d.file_name),
      };
      addAnalysis(entry);
    } catch (e) {
      setError((e as Error).message);
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setStep(0);
    setMessage("");
    setResult(null);
    setError(null);
    setLocalDocs([]);
  }

  /* ------------------------------------------------------------- result */

  if (step === 4) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Analysis"
          title="Your health summary"
          description="Read this alongside the report it came from. Everything below is a starting point for a conversation with a clinician."
          actions={
            <>
              <Button icon="refresh" onClick={startOver}>
                New analysis
              </Button>
              <Button tone="soft" icon="chat" onClick={() => router.push("/assistant")}>
                Ask a follow-up
              </Button>
            </>
          }
        />

        {busy ? (
          <AnalysisLoading />
        ) : result ? (
          <ResultPanel
            assessment={result.assessment}
            triage={result.triage}
            question={message.trim()}
            documentNames={attachedDocs.map((d) => d.file_name)}
            citations={result.citations}
            traceId={result.trace_id}
            onFollowUp={(q) => router.push(`/assistant?q=${encodeURIComponent(q)}`)}
          />
        ) : null}
      </div>
    );
  }

  /* -------------------------------------------------------------- wizard */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Health analysis"
        title="Tell CareFlow what is going on"
        description="Four short steps. You can stop after any of them, and nothing is sent until you confirm on the review step."
      />

      <Card className="px-4 py-2 sm:px-5">
        <ProgressSteps steps={STEPS} current={step} onJump={(i) => go(i as Step)} />
      </Card>

      {error ? (
        <Alert tone="alert" title="That analysis could not be completed">
          {error}
        </Alert>
      ) : null}

      {/* ------------------------------------------------ 1. patient details */}
      {step === 0 ? (
        <div className="animate-rise space-y-5">
          <Card>
            <div className="p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold text-ink">About you</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                This is used only to make the summary safer — for example, age and allergies change
                how a result should be read. Nothing here is sent until step four.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="cf-name" hint="Optional">
                  <Input
                    id="cf-name"
                    value={profile.full_name}
                    placeholder="e.g. Ayesha Khan"
                    onChange={(e) => updateProfile({ full_name: e.target.value })}
                  />
                </Field>
                <Field label="Age" htmlFor="cf-age" hint="Needed to read reference ranges correctly">
                  <Input
                    id="cf-age"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    value={profile.age ?? ""}
                    placeholder="e.g. 34"
                    onChange={(e) =>
                      updateProfile({ age: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </Field>
                <Field label="Sex" htmlFor="cf-sex">
                  <Select
                    id="cf-sex"
                    value={profile.sex ?? ""}
                    onChange={(e) =>
                      updateProfile({ sex: (e.target.value || null) as typeof profile.sex })
                    }
                  >
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field label="Weight" htmlFor="cf-weight" hint="kg">
                  <Input
                    id="cf-weight"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={profile.weight_kg ?? ""}
                    placeholder="e.g. 62"
                    onChange={(e) =>
                      updateProfile({ weight_kg: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </Field>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Known allergies"
                  htmlFor="cf-allergies"
                  hint="Separate with commas"
                >
                  <Input
                    id="cf-allergies"
                    value={profile.allergies.join(", ")}
                    placeholder="e.g. Penicillin, Sulfa"
                    onChange={(e) =>
                      updateProfile({
                        allergies: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field
                  label="Medicines you take"
                  htmlFor="cf-meds"
                  hint="Name and dose if you know it"
                >
                  <Input
                    id="cf-meds"
                    value={profile.current_meds.join(", ")}
                    placeholder="e.g. Metformin 500mg, Atorvastatin 10mg"
                    onChange={(e) =>
                      updateProfile({
                        current_meds: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              </div>

              {(profile.is_pregnant || profile.is_breastfeeding) ? (
                <div className="mt-5 flex flex-col gap-3 rounded-card border border-warn-line bg-warn-soft/50 p-4 sm:flex-row sm:gap-6">
                  <label className="flex items-center gap-2.5 text-[14px] text-ink">
                    <input
                      type="checkbox"
                      checked={profile.is_pregnant}
                      onChange={(e) => updateProfile({ is_pregnant: e.target.checked })}
                      className="h-4 w-4 rounded border-line-strong accent-[var(--warn)]"
                    />
                    Currently pregnant
                  </label>
                  <label className="flex items-center gap-2.5 text-[14px] text-ink">
                    <input
                      type="checkbox"
                      checked={profile.is_breastfeeding}
                      onChange={(e) => updateProfile({ is_breastfeeding: e.target.checked })}
                      className="h-4 w-4 rounded border-line-strong accent-[var(--warn)]"
                    />
                    Currently breastfeeding
                  </label>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => updateProfile({ is_pregnant: true })}
                  className="mt-4 text-[13px] font-medium text-primary-text hover:underline"
                >
                  + Are you pregnant or breastfeeding?
                </button>
              )}
            </div>
          </Card>

          <WizardNav
            onBack={null}
            nextLabel="Continue to symptoms"
            onNext={() => go(1)}
          />
        </div>
      ) : null}

      {/* ----------------------------------------------------- 2. symptoms */}
      {step === 1 ? (
        <div className="animate-rise space-y-5">
          <Card>
            <div className="p-5 sm:p-6">
              <Field
                label="Describe what is happening"
                htmlFor="cf-message"
                required
                hint="Include when it started, how severe it is, and anything that makes it better or worse."
                error={
                  message.length > 0 && !symptomsLongEnough
                    ? "Please add a little more detail so the summary is useful."
                    : undefined
                }
              >
                <Textarea
                  id="cf-message"
                  rows={7}
                  value={message}
                  placeholder="e.g. I have had a fever since Monday, around 38.5°C, with body aches and a sore throat. It gets worse in the evening. I have taken paracetamol twice."
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>

              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-faint">
                <Icon name="lock" size={13} />
                {message.trim().length} characters · nothing is sent yet
              </p>
            </div>
          </Card>

          <div>
            <p className="mb-2.5 text-[13px] font-medium text-muted">
              Not sure how to start? Try one of these
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => setMessage(starter)}
                  className={cx(
                    "rounded-pill border border-line bg-surface px-3.5 py-2 text-[13px] text-muted",
                    "hover:border-primary-line hover:bg-primary-soft hover:text-primary-text",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  )}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>

          <WizardNav
            onBack={() => go(0)}
            nextLabel="Continue to reports"
            onNext={() => go(2)}
          />
        </div>
      ) : null}

      {/* ------------------------------------------------------- 3. reports */}
      {step === 2 ? (
        <div className="animate-rise space-y-5">
          <Card>
            <div className="p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold text-ink">
                Add your test reports
              </h2>
              <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted">
                CareFlow reads each report, pulls out the measured values, and compares them with
                the reference ranges printed on the report itself. You can analyse without a report
                if you like.
              </p>
              <div className="mt-5">
                <UploadPanel
                  mrn={profile.mrn || undefined}
                  age={profile.age ?? undefined}
                  onUploaded={(id) => setLocalDocs((prev) => [...prev, id])}
                />
              </div>
            </div>
          </Card>

          {documents.length ? (
            <Card>
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-[14.5px] font-semibold text-ink">
                  Reports in this analysis
                </h3>
                <p className="mt-1 text-[12.5px] text-muted">
                  All {documents.length} of your uploaded{" "}
                  {documents.length === 1 ? "report is" : "reports are"} attached automatically.
                </p>
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 px-5 py-3">
                    <Icon name="file" size={16} className="shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {doc.file_name}
                      </span>
                      <span className="text-[12px] text-faint">
                        {doc.findings.length} values read
                      </span>
                    </span>
                    <Icon name="check" size={15} className="shrink-0 text-ok" />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <WizardNav
            onBack={() => go(1)}
            nextLabel="Continue to review"
            onNext={() => go(3)}
          />
        </div>
      ) : null}

      {/* -------------------------------------------------------- 4. review */}
      {step === 3 ? (
        <div className="animate-rise space-y-5">
          <Card>
            <div className="p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold text-ink">Review before sending</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                This is exactly what CareFlow will analyse.
              </p>

              <dl className="mt-5 divide-y divide-line overflow-hidden rounded-card border border-line">
                <div className="bg-sunken/60 px-4 py-2.5">
                  <dt className="text-[11.5px] font-semibold tracking-[0.05em] text-faint uppercase">
                    Your description
                  </dt>
                </div>
                <div className="px-4 py-3.5">
                  <dd className="text-[14.5px] leading-[1.7] whitespace-pre-wrap text-ink/85">
                    {message.trim()}
                  </dd>
                </div>

                <div className="bg-sunken/60 px-4 py-2.5">
                  <dt className="text-[11.5px] font-semibold tracking-[0.05em] text-faint uppercase">
                    Reports attached
                  </dt>
                </div>
                <div className="px-4 py-3.5">
                  {attachedDocs.length ? (
                    <dd className="space-y-1.5">
                      {attachedDocs.map((doc) => (
                        <p key={doc.id} className="flex items-center gap-2 text-[14px] text-ink/85">
                          <Icon name="file" size={14} className="shrink-0 text-primary" />
                          {doc.file_name}
                          <span className="text-[12.5px] text-faint">
                            · {doc.findings.length} values
                          </span>
                        </p>
                      ))}
                    </dd>
                  ) : (
                    <dd className="text-[14px] text-faint">No reports attached</dd>
                  )}
                </div>

                <div className="bg-sunken/60 px-4 py-2.5">
                  <dt className="text-[11.5px] font-semibold tracking-[0.05em] text-faint uppercase">
                    Patient details
                  </dt>
                </div>
                <div className="px-4 py-3.5">
                  <dd className="flex flex-wrap gap-1.5">
                    {profile.full_name || profile.age || profile.sex ? (
                      <>
                        {profile.full_name ? <Pill>{profile.full_name}</Pill> : null}
                        {profile.age ? <Pill>{profile.age} years</Pill> : null}
                        {profile.sex ? <Pill>{profile.sex}</Pill> : null}
                      </>
                    ) : (
                      <span className="text-[14px] text-faint">
                        Not provided — the summary will be more general
                      </span>
                    )}
                    {profile.allergies.map((a) => (
                      <Pill key={a} tone="alert">
                        Allergy: {a}
                      </Pill>
                    ))}
                    {profile.current_meds.map((m) => (
                      <Pill key={m} tone="primary">
                        {m}
                      </Pill>
                    ))}
                  </dd>
                </div>

                <div className="bg-sunken/60 px-4 py-2.5">
                  <dt className="text-[11.5px] font-semibold tracking-[0.05em] text-faint uppercase">
                    Response language
                  </dt>
                </div>
                <div className="px-4 py-3.5">
                  <dd className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label="Response language"
                      className="h-9 w-auto min-w-40"
                      value={state.settings.language}
                      onChange={(e) =>
                        updateSettings({
                          language: e.target.value as typeof state.settings.language,
                        })
                      }
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.key} value={l.key}>
                          {l.native}
                        </option>
                      ))}
                    </Select>
                    <span className="text-[12.5px] text-faint">
                      You can change this later in Profile.
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <Disclaimer />
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button icon="arrow_left" onClick={() => go(2)} disabled={busy}>
              Back
            </Button>
            <Button
              tone="primary"
              size="lg"
              icon="activity"
              loading={busy}
              disabled={!symptomsLongEnough}
              onClick={() => void submit()}
              className="sm:min-w-56"
            >
              {busy ? "Analysing…" : "Analyse my information"}
            </Button>
          </div>

          {!symptomsLongEnough ? (
            <p className="text-center text-[13px] text-warn-text sm:text-left">
              Add a little more detail to your description first.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={cx(
        "rounded-pill border px-2.5 py-0.5 text-[12.5px]",
        tone === "alert"
          ? "border-alert-line bg-alert-soft text-alert-text"
          : tone === "primary"
            ? "border-primary-line bg-primary-soft text-primary-text"
            : "border-line bg-sunken text-muted",
      )}
    >
      {children}
    </span>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextLabel,
}: {
  onBack: (() => void) | null;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button icon="arrow_left" onClick={onBack}>
          Back
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <Button tone="primary" iconRight="arrow_right" onClick={onNext} size="lg">
        {nextLabel}
      </Button>
    </div>
  );
}
