"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon } from "../components/icons";
import { AnalysisSkeleton } from "../components/AnalysisLoading";
import { useCareflow } from "../components/CareflowProvider";
import { normaliseFlag } from "../components/ReportTable";
import {
  Alert,
  Badge,
  Card,
  Disclaimer,
  EmptyState,
  LinkButton,
  SectionTitle,
  cx,
} from "../components/ui";
import {
  URGENT_LEVELS,
  attentionCount,
  firstName,
  fullDate,
  greeting,
  labStatusMeta,
  plural,
  relativeTime,
  truncate,
  triageMeta,
} from "../lib/format";

export default function DashboardPage() {
  const { state } = useCareflow();
  const { profile, documents, analyses, ready } = state;

  const latest = analyses[0];

  /* Anything that genuinely needs attention, surfaced above the fold. */
  const alerts = useMemo(() => {
    const out: { id: string; level: "urgent" | "caution" | "info"; title: string; body: string; href: string }[] = [];
    for (const a of analyses) {
      if (URGENT_LEVELS.includes(a.triage.level)) {
        out.push({
          id: `triage-${a.id}`,
          level: "urgent",
          title: triageMeta(a.triage.level).label,
          body: a.triage.immediate_advice || triageMeta(a.triage.level).blurb,
          href: `/history/${a.id}`,
        });
      }
      const flagged = attentionCount((a.assessment.lab_results ?? []).map((r) => r.status));
      if (flagged >= 2) {
        out.push({
          id: `labs-${a.id}`,
          level: "caution",
          title: `${plural(flagged, "result")} outside the reference range`,
          body: `From your analysis on ${fullDate(a.created_at)}. Worth discussing with a doctor.`,
          href: `/history/${a.id}`,
        });
      }
    }
    return out.slice(0, 3);
  }, [analyses]);

  const profileFields = [
    profile.full_name,
    profile.age,
    profile.sex,
    profile.allergies.length ? "allergies" : null,
    profile.current_meds.length ? "meds" : null,
  ].filter(Boolean).length;

  if (!ready) {
    return (
      <div className="space-y-6">
        <AnalysisSkeleton />
      </div>
    );
  }

  const nothingYet = !latest && documents.length === 0;

  return (
    <div className="space-y-7">
      {/* ------------------------------------------------------- welcome */}
      <header className="relative overflow-hidden rounded-card border border-line bg-surface p-6 shadow-card sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-primary-text">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1 className="mt-1 text-[27px] leading-[1.2] font-semibold tracking-[-0.025em] text-ink sm:text-[32px]">
              {greeting()}
              {profile.full_name ? `, ${firstName(profile.full_name)}` : ""}.
            </h1>
            <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-muted">
              {latest
                ? `Your last analysis was ${relativeTime(latest.created_at)}. Ask a follow-up, or start something new.`
                : "Tell CareFlow how you are feeling or upload a test report, and get a clear, structured explanation of what it means."}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <LinkButton href="/analysis" tone="primary" size="lg" icon="activity">
              Start health analysis
            </LinkButton>
            <LinkButton href="/analysis?step=reports" tone="secondary" size="lg" icon="upload">
              Upload a test report
            </LinkButton>
          </div>
        </div>

        <Disclaimer className="mt-6 border-t border-line pt-4" />
      </header>

      {/* -------------------------------------------------------- alerts */}
      {alerts.length ? (
        <section aria-label="Health alerts" className="space-y-3">
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              tone={alert.level === "urgent" ? "alert" : "warn"}
              title={alert.title}
              action={
                <Link
                  href={alert.href}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-ink underline-offset-2 hover:underline"
                >
                  View
                  <Icon name="chevron_right" size={14} />
                </Link>
              }
            >
              {alert.body}
            </Alert>
          ))}
        </section>
      ) : nothingYet ? null : (
        <Alert tone="ok" title="Nothing needs urgent attention">
          Nothing in your recent analyses has been flagged as needing urgent care. This is not a
          substitute for seeking help if you feel unwell.
        </Alert>
      )}

      {/* --------------------------------------------------------- body */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {/* ------------------------------------------ recent analyses */}
          <section>
            <SectionTitle
              icon="clock"
              action={
                analyses.length > 3 ? (
                  <Link
                    href="/history"
                    className="text-[13px] font-medium text-primary-text hover:underline"
                  >
                    View all
                  </Link>
                ) : undefined
              }
            >
              Recent analyses
            </SectionTitle>

            {analyses.length === 0 ? (
              <EmptyState
                icon="activity"
                title="Your analyses will appear here"
                body="Once CareFlow analyses a report or a set of symptoms, the summary is saved so you can come back to it."
                action={
                  <LinkButton href="/analysis" tone="primary" icon="plus">
                    Start your first analysis
                  </LinkButton>
                }
              />
            ) : (
              <ul className="stagger space-y-2.5">
                {analyses.slice(0, 4).map((item) => {
                  const meta = triageMeta(item.triage.level);
                  const flagged = attentionCount(
                    (item.assessment.lab_results ?? []).map((r) => r.status),
                  );
                  return (
                    <Card key={item.id} as="li" interactive className="overflow-hidden">
                      <Link href={`/history/${item.id}`} className="block p-4 no-underline">
                        <div className="flex items-start gap-3">
                          <span
                            className={cx(
                              "mt-1 h-2 w-2 shrink-0 rounded-full",
                              meta.dot,
                            )}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[14.5px] leading-snug font-medium text-ink">
                              {truncate(item.question, 130)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                              <Badge tone="neutral" className={meta.badge}>
                                {meta.label}
                              </Badge>
                              {flagged ? (
                                <Badge tone="warn" icon="alert">
                                  {plural(flagged, "result")} to review
                                </Badge>
                              ) : null}
                              {item.assessment.requires_consultation ? (
                                <Badge tone="primary" icon="stethoscope">
                                  Consult a doctor
                                </Badge>
                              ) : null}
                              <span className="text-[12.5px] text-faint">
                                {relativeTime(item.created_at)}
                              </span>
                            </div>
                          </div>
                          <Icon name="chevron_right" size={16} className="mt-1 shrink-0 text-faint" />
                        </div>
                      </Link>
                    </Card>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ---------------------------------------------- quick ask box */}
          {!nothingYet ? (
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[15.5px] font-semibold text-ink">
                    Have a question about your results?
                  </h2>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                    Your reports and history stay attached, so follow-ups build on what CareFlow
                    already knows about you.
                  </p>
                </div>
                <LinkButton href="/assistant" tone="soft" icon="chat" className="shrink-0">
                  Open assistant
                </LinkButton>
              </div>
            </Card>
          ) : null}
        </div>

        {/* ------------------------------------------------------- aside */}
        <div className="min-w-0 space-y-6">
          <section>
            <SectionTitle
              icon="file"
              action={
                documents.length ? (
                  <Link
                    href="/reports"
                    className="text-[13px] font-medium text-primary-text hover:underline"
                  >
                    View all
                  </Link>
                ) : undefined
              }
            >
              Recent reports
            </SectionTitle>

            <Card>
              {documents.length === 0 ? (
                <div className="px-5 py-7 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-faint">
                    <Icon name="file" size={18} />
                  </div>
                  <p className="mt-3 text-[14px] font-medium text-ink">No reports uploaded yet</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                    Upload your first test report to get it explained.
                  </p>
                  <LinkButton
                    href="/analysis?step=reports"
                    tone="secondary"
                    size="sm"
                    icon="upload"
                    className="mt-3.5"
                  >
                    Upload
                  </LinkButton>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {documents.slice(0, 3).map((doc) => {
                    const flagged = doc.findings.filter(
                      (f) => labStatusMeta(normaliseFlag(f.flag)).rank >= 3,
                    ).length;
                    return (
                      <li key={doc.id}>
                        <Link
                          href={`/reports/${doc.id}`}
                          className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-sunken"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                            <Icon name="file" size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-ink">
                              {doc.file_name}
                            </span>
                            <span className="mt-0.5 block text-[12px] text-faint">
                              {relativeTime(doc.uploaded_at)} ·{" "}
                              {plural(doc.findings.length, "value")}
                              {flagged ? ` · ${flagged} flagged` : ""}
                            </span>
                          </span>
                          <Icon name="chevron_right" size={15} className="shrink-0 text-faint" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle icon="user">Your profile</SectionTitle>
            <Card>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-line bg-primary-soft text-[13px] font-semibold text-primary-text">
                    {profile.full_name
                      ? profile.full_name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase())
                          .join("")
                      : "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-ink">
                      {profile.full_name || "No name set"}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {profileFields
                        ? `${profileFields} of 6 details added`
                        : "Details help CareFlow give safer answers"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-pill bg-sunken">
                  <div
                    className="h-full rounded-pill bg-primary transition-[width] duration-500"
                    style={{ width: `${(profileFields / 6) * 100}%` }}
                  />
                </div>

                {profile.allergies.length || profile.current_meds.length ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {profile.allergies.map((a) => (
                      <Badge key={`a-${a}`} tone="alert" icon="alert">
                        {a}
                      </Badge>
                    ))}
                    {profile.current_meds.map((m) => (
                      <Badge key={`m-${m}`} tone="primary" icon="pill">
                        {m}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <LinkButton href="/profile" tone="secondary" size="sm" className="mt-4 w-full">
                  Complete profile
                </LinkButton>
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle icon="shield">How CareFlow works</SectionTitle>
            <Card>
              <ul className="divide-y divide-line text-[13.5px]">
                {[
                  {
                    icon: "activity" as const,
                    title: "You describe the situation",
                    body: "Symptoms, timings, or a report you were given.",
                  },
                  {
                    icon: "droplet" as const,
                    title: "CareFlow reads your report",
                    body: "Values are compared with the reference ranges printed on it.",
                  },
                  {
                    icon: "search" as const,
                    title: "You get a structured summary",
                    body: "Possibilities, cautions and next steps — clearly labelled as possibilities.",
                  },
                ].map((row) => (
                  <li key={row.title} className="flex gap-3 px-5 py-3.5">
                    <Icon name={row.icon} size={16} className="mt-0.5 shrink-0 text-primary" />
                    <span>
                      <span className="block font-medium text-ink">{row.title}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">
                        {row.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>
      </div>

      {nothingYet ? (
        <Card className="border-dashed">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon name="heart" size={22} />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-ink">Welcome to CareFlow</p>
              <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">
                CareFlow explains health information — test results, symptoms and medicines — in
                plain language, so you know what to ask your doctor. Start with a symptom, or upload
                a report you already have.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <LinkButton href="/analysis" tone="primary" size="lg" icon="activity">
                Start health analysis
              </LinkButton>
              <LinkButton href="/profile" tone="secondary" size="lg" icon="user">
                Set up your profile
              </LinkButton>
            </div>
            <div className="flex items-center gap-1.5 text-[12.5px] text-faint">
              <Icon name="lock" size={13} />
              Your data stays in this browser
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
