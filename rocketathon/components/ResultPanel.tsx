"use client";

/**
 * The analysis result. Deliberately NOT a chat bubble: it is a structured
 * medical-information document with a table of contents, so a user can read,
 * scan, and print it the way they would a discharge summary.
 */

import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Accordion } from "./interactive";
import { Badge, Button, Card, Disclaimer, cx } from "./ui";
import { LabTable } from "./ReportTable";
import { MedicationList } from "./MedicationCard";
import {
  CAUSE_STATUS,
  fullDate,
  clockTime,
  labStatusMeta,
  triageMeta,
  plural,
  truncate,
  URGENT_LEVELS,
} from "../lib/format";
import type { AskResponse, PatientAssessment, TriageScreen } from "../lib/types";

/* ------------------------------------------------------- triage banner */

export function TriageBanner({ triage }: { triage: TriageScreen }) {
  const meta = triageMeta(triage.level);
  const urgent = URGENT_LEVELS.includes(triage.level);

  return (
    <div
      role={urgent ? "alert" : "status"}
      className={cx("rounded-card border px-4 py-4 sm:px-5", meta.banner)}
    >
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            urgent ? "bg-alert text-white" : "bg-white/70 text-ink",
          )}
        >
          <Icon name={urgent ? "alert" : "heart"} size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cx(
              "text-[15px] font-semibold",
              urgent ? "text-alert-text" : "text-ink",
            )}
          >
            {meta.label}
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink/80">
            {triage.immediate_advice || meta.blurb}
          </p>

          {triage.red_flags.length ? (
            <div className="mt-3">
              <p className="text-[11.5px] font-semibold tracking-[0.05em] text-faint uppercase">
                What triggered this
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {triage.red_flags.map((flag, i) => (
                  <li key={i}>
                    <Badge tone="neutral" className="border-current/15 bg-white/70 text-ink/80">
                      {flag}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {triage.needs_human_review ? (
            <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-ink/70">
              <Icon name="stethoscope" size={14} />
              Flagged for clinician review
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- confidence note */

function confidenceLabel(value: number): { label: string; tone: string; width: number } {
  if (value < 0.45) return { label: "Limited", tone: "bg-warn", width: 32 };
  if (value < 0.7) return { label: "Moderate", tone: "bg-info", width: 62 };
  return { label: "Good", tone: "bg-ok", width: 90 };
}

/* ------------------------------------------------------------- section */

function Section({
  id,
  index,
  icon,
  title,
  hint,
  children,
  action,
}: {
  id: string;
  index: number;
  icon: IconName;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section id={id} className="print-block scroll-mt-20">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-primary-soft text-primary">
            <Icon name={icon} size={15} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16.5px] font-semibold tracking-[-0.01em] text-ink">
              <span className="mr-1.5 text-faint">{index}.</span>
              {title}
            </h2>
            {hint ? <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Prose({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={cx("text-[14.5px] leading-[1.75] text-ink/85", className)}>{text}</p>
  );
}

function Checklist({
  items,
  tone,
  empty,
}: {
  items: string[];
  tone: "primary" | "warn" | "info";
  empty: string;
}) {
  if (!items.length) return <p className="text-[13.5px] text-faint">{empty}</p>;
  const map = {
    primary: { wrap: "border-line", icon: "check_small" as IconName, tint: "text-primary" },
    warn: { wrap: "border-warn-line bg-warn-soft/50", icon: "alert" as IconName, tint: "text-warn" },
    info: { wrap: "border-info-line bg-info-soft/50", icon: "bulb" as IconName, tint: "text-info" },
  }[tone];

  return (
    <ul className={cx("divide-y divide-line overflow-hidden rounded-card border", map.wrap)}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 px-4 py-3">
          <Icon name={map.icon} size={15} className={cx("mt-0.5 shrink-0", map.tint)} />
          <span className="text-[14px] leading-relaxed text-ink/85">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ the panel */

export function ResultPanel({
  assessment,
  triage,
  question,
  createdAt,
  documentNames = [],
  citations = [],
  traceId,
  onFollowUp,
  compact = false,
}: {
  assessment: PatientAssessment;
  triage: TriageScreen;
  question?: string;
  createdAt?: string;
  documentNames?: string[];
  citations?: string[];
  traceId?: string | null;
  onFollowUp?: (question: string) => void;
  compact?: boolean;
}) {
  const confidence = confidenceLabel(assessment.confidence ?? 0);
  const flagged = assessment.lab_results.filter(
    (r) => labStatusMeta(r.status).rank >= 3,
  ).length;

  const sections: { id: string; index: number; icon: IconName; title: string }[] = [];
  const add = (id: string, icon: IconName, title: string, show: boolean) => {
    if (show) sections.push({ id, index: sections.length + 1, icon, title });
  };

  add("summary", "user", "Patient summary", Boolean(assessment.patient_summary));
  add(
    "symptoms",
    "activity",
    "Symptoms and findings",
    Boolean(assessment.important_symptoms_findings),
  );
  add("reports", "droplet", "Test report interpretation", assessment.lab_results.length > 0 || Boolean(assessment.test_report_interpretation));
  add("causes", "search", "Possible causes", assessment.possible_causes.length > 0);
  add("medicines", "pill", "Medication and treatment safety", assessment.medication_safety.length > 0);
  add("treatment", "heart", "Treatment guidance", Boolean(assessment.treatment_guidance));
  add("next-steps", "arrow_right", "Recommended next steps", assessment.next_steps.length > 0);
  add("warnings", "alert", "Warning signs", assessment.warning_signs.length > 0);
  add("needed", "bulb", "Information still needed", assessment.information_needed.length > 0);

  return (
    <div className="space-y-6">
      <TriageBanner triage={triage} />

      {/* ------------------------------------------------- summary header */}
      <Card>
        <div className="flex flex-col gap-4 p-5">
          {question ? (
            <div>
              <p className="text-[11.5px] font-semibold tracking-[0.05em] text-faint uppercase">
                You asked
              </p>
              <p className="mt-1.5 text-[15px] leading-relaxed font-medium text-ink">
                “{truncate(question, 220)}”
              </p>
            </div>
          ) : null}

          {documentNames.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px] font-semibold tracking-[0.05em] text-faint uppercase">
                Reports read
              </span>
              {documentNames.map((name, i) => (
                <Badge key={i} tone="primary" icon="file">
                  {name}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-muted">
                Confidence in this summary
              </p>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full" style={{ background: `var(--${confidence.tone === "bg-ok" ? "ok" : confidence.tone === "bg-warn" ? "warn" : "info"})` }} aria-hidden="true" />
                <span className="text-[14px] font-semibold text-ink">{confidence.label}</span>
                <div
                  className="h-1.5 w-24 overflow-hidden rounded-pill bg-sunken"
                  role="img"
                  aria-label={`Confidence: ${confidence.label}`}
                >
                  <div className={cx("h-full rounded-pill", confidence.tone)} style={{ width: `${confidence.width}%` }} />
                </div>
              </div>
              <p className="mt-1.5 max-w-md text-[11.5px] leading-relaxed text-faint">
                This reflects how complete the information you provided was — not the chance that
                you have any particular condition.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 no-print">
              {flagged > 0 ? (
                <Badge tone="warn" icon="alert">
                  {plural(flagged, "result")} to review
                </Badge>
              ) : null}
              {assessment.requires_consultation ? (
                <Badge tone="primary" icon="stethoscope">
                  Consult a doctor
                </Badge>
              ) : null}
              <Button size="sm" icon="print" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          </div>

          {createdAt ? (
            <p className="text-[11.5px] text-faint">
              Generated {fullDate(createdAt)} at {clockTime(createdAt)}
            </p>
          ) : null}
        </div>
      </Card>

      {/* ------------------------------------------------- contents + body */}
      <div className={cx("grid gap-8", !compact && "lg:grid-cols-[196px_minmax(0,1fr)]")}>
        {!compact ? (
          <nav aria-label="On this page" className="no-print hidden lg:block">
            <div className="sticky top-6">
              <p className="mb-2.5 text-[11px] font-semibold tracking-[0.07em] text-faint uppercase">
                On this page
              </p>
              <ul className="space-y-0.5 border-l border-line">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="-ml-px block border-l-2 border-transparent py-1.5 pl-3 text-[13px] leading-snug text-muted hover:border-primary-line hover:text-ink"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>

              {onFollowUp ? (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="mb-2 text-[11.5px] font-semibold tracking-[0.05em] text-faint uppercase">
                    Ask a follow-up
                  </p>
                  <div className="space-y-1.5">
                    {["What should I ask my doctor?", "Are my medicines interacting?"].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onFollowUp(q)}
                        className="flex w-full items-start gap-1.5 rounded-control border border-line bg-surface px-2.5 py-2 text-left text-[12.5px] leading-snug text-muted hover:border-primary-line hover:text-ink"
                      >
                        <Icon name="chat" size={13} className="mt-px shrink-0 text-faint" />
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </nav>
        ) : null}

        <div className="min-w-0 space-y-7">
          {sections.some((s) => s.id === "summary") ? (
            <Section id="summary" index={1} icon="user" title="Patient summary">
              <Prose text={assessment.patient_summary} />
            </Section>
          ) : null}

          {sections.some((s) => s.id === "symptoms") ? (
            <Section
              id="symptoms"
              index={2}
              icon="activity"
              title="Symptoms and findings"
              hint="What you described, and what stands out in it"
            >
              <Prose text={assessment.important_symptoms_findings} />
            </Section>
          ) : null}

          {sections.some((s) => s.id === "reports") ? (
            <Section
              id="reports"
              index={3}
              icon="droplet"
              title="Test report interpretation"
              hint="Your values compared with the reference ranges on your own report"
            >
              <div className="space-y-4">
                {assessment.test_report_interpretation ? (
                  <Prose text={assessment.test_report_interpretation} />
                ) : null}
                <LabTable rows={assessment.lab_results} />
              </div>
            </Section>
          ) : null}

          {sections.some((s) => s.id === "causes") ? (
            <Section
              id="causes"
              index={4}
              icon="search"
              title="Possible causes"
              hint="Possibilities to discuss with a clinician — not a diagnosis"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(CAUSE_STATUS).map(([key, meta]) => (
                    <span
                      key={key}
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11.5px] font-medium",
                        meta.badge,
                      )}
                    >
                      {meta.label}
                    </span>
                  ))}
                </div>

                <Accordion
                  title="How to read these labels"
                  icon="info"
                  subtitle="Why the same condition can appear under different labels"
                >
                  <dl className="space-y-2.5">
                    {Object.entries(CAUSE_STATUS).map(([key, meta]) => (
                      <div key={key} className="flex gap-3">
                        <dt className="w-24 shrink-0 text-[13px] font-medium text-ink">
                          {meta.label}
                        </dt>
                        <dd className="text-[13px] leading-relaxed text-muted">{meta.hint}</dd>
                      </div>
                    ))}
                  </dl>
                </Accordion>

                <div className="space-y-2.5">
                  {assessment.possible_causes.map((cause, i) => {
                    const meta = CAUSE_STATUS[cause.status] ?? CAUSE_STATUS.possible;
                    return (
                      <Accordion
                        key={`${cause.name}-${i}`}
                        icon="search"
                        title={cause.name}
                        subtitle={meta.hint}
                        badge={<Badge tone="neutral" className={meta.badge}>{meta.label}</Badge>}
                      >
                        <div className="space-y-3">
                          <Prose text={cause.reasoning} className="text-[14px]" />
                          {cause.confirm_with ? (
                            <p className="flex items-start gap-2 rounded-control border border-line bg-sunken px-3.5 py-2.5 text-[13px] leading-relaxed text-ink/80">
                              <Icon name="stethoscope" size={15} className="mt-px shrink-0 text-primary" />
                              <span>
                                <span className="font-medium text-ink">How to confirm: </span>
                                {cause.confirm_with}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </Accordion>
                    );
                  })}
                </div>
              </div>
            </Section>
          ) : null}

          {sections.some((s) => s.id === "medicines") ? (
            <Section
              id="medicines"
              index={5}
              icon="pill"
              title="Medication and treatment safety"
              hint="Information only — never a prescription"
            >
              <div className="space-y-3">
                <p className="text-[13.5px] leading-relaxed text-muted">
                  CareFlow cannot start, stop, or change a prescription. Each medicine below is
                  flagged for a qualified professional to confirm.
                </p>
                <MedicationList items={assessment.medication_safety} />
              </div>
            </Section>
          ) : null}

          {sections.some((s) => s.id === "treatment") ? (
            <Section
              id="treatment"
              index={6}
              icon="heart"
              title="Treatment guidance"
              hint="General supportive measures, to discuss with your clinician"
            >
              <Prose text={assessment.treatment_guidance} />
            </Section>
          ) : null}

          {sections.some((s) => s.id === "next-steps") ? (
            <Section
              id="next-steps"
              index={7}
              icon="arrow_right"
              title="Recommended next steps"
              hint="In the order we suggest discussing them"
            >
              <Checklist
                items={assessment.next_steps}
                tone="primary"
                empty="No specific next steps were suggested."
              />
            </Section>
          ) : null}

          {sections.some((s) => s.id === "warnings") ? (
            <Section
              id="warnings"
              index={8}
              icon="alert"
              title="Warning signs"
              hint="Seek urgent care if any of these appear"
            >
              <Checklist
                items={assessment.warning_signs}
                tone="warn"
                empty="No specific warning signs were identified from the information provided."
              />
            </Section>
          ) : null}

          {sections.some((s) => s.id === "needed") ? (
            <Section
              id="needed"
              index={9}
              icon="bulb"
              title="Information still needed"
              hint="Answering these would make the summary considerably more useful"
            >
              <Checklist
                items={assessment.information_needed}
                tone="info"
                empty="Nothing further is needed to be useful right now."
              />
            </Section>
          ) : null}

          {/* ------------------------------------------------- footer */}
          <div className="space-y-3 border-t border-line pt-5">
            {citations.length ? (
              <details className="text-[12.5px] text-muted">
                <summary className="cursor-pointer font-medium text-ink hover:text-primary-text">
                  Sources used ({citations.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {citations.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <Icon name="check_small" size={13} className="mt-0.5 shrink-0 text-ok" />
                      {c}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {traceId ? (
              <p className="font-mono text-[11px] text-faint">
                trace_id {traceId}
                {flagged > 0 ? ` · ${flagged} flagged` : ""}
              </p>
            ) : null}

            <Disclaimer />
            {assessment.disclaimer ? (
              <p className="text-[12px] leading-relaxed text-faint italic">{assessment.disclaimer}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Convenience wrapper when the caller holds a whole API response. */
export function ResponsePanel({
  response,
  question,
  createdAt,
  documentNames,
  onFollowUp,
}: {
  response: AskResponse;
  question?: string;
  createdAt?: string;
  documentNames?: string[];
  onFollowUp?: (question: string) => void;
}) {
  return (
    <ResultPanel
      assessment={response.assessment}
      triage={response.triage}
      question={question}
      createdAt={createdAt}
      documentNames={documentNames}
      citations={response.citations}
      traceId={response.trace_id}
      onFollowUp={onFollowUp}
    />
  );
}
