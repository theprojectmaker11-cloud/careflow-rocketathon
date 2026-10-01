"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Icon } from "../../../components/icons";
import { DocumentFindings, NoFindings, normaliseFlag } from "../../../components/ReportTable";
import { useCareflow } from "../../../components/CareflowProvider";
import { fetchDocument } from "../../../lib/api";
import {
  Alert,
  Badge,
  Button,
  Card,
  Disclaimer,
  LinkButton,
  Meta,
  SectionTitle,
  Skeleton,
  cx,
} from "../../../components/ui";
import { bytes, fullDate, labStatusMeta, plural, titleCase } from "../../../lib/format";
import type { StoredDocument } from "../../../lib/types";

export default function ReportViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { state } = useCareflow();
  const local = state.documents.find((d) => d.id === id);

  const [doc, setDoc] = useState<StoredDocument | null>(local ?? null);
  const [loading, setLoading] = useState(!local);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Local copy is enough to render. Only reach the API when we need the full
  // record (for example after a page reload with a stale localStorage entry).
  useEffect(() => {
    let cancelled = false;
    if (local) return;
    (async () => {
      try {
        const remote = await fetchDocument(id);
        if (cancelled) return;
        setDoc({
          id: remote.id,
          file_name: remote.file_name ?? "Report",
          doc_type: remote.doc_type,
          mime: "application/octet-stream",
          size_bytes: 0,
          uploaded_at: new Date().toISOString(),
          findings: remote.findings ?? [],
          reported_medications: remote.reported_medications ?? [],
          impressions: remote.impressions ?? [],
        });
      } catch (e) {
        if (!cancelled) setFetchError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, local]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="space-y-5">
        <Alert tone="warn" title="Report not found">
          {fetchError ??
            "This report is not stored in this browser. It may have been uploaded on a different device."}
        </Alert>
        <LinkButton href="/reports" tone="secondary" icon="arrow_left">
          Back to reports
        </LinkButton>
      </div>
    );
  }

  const flagged = doc.findings.filter((f) => labStatusMeta(normaliseFlag(f.flag)).rank >= 3);
  const inRange = doc.findings.filter((f) => labStatusMeta(normaliseFlag(f.flag)).rank === 0);

  return (
    <div className="space-y-6">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted no-underline hover:text-ink"
      >
        <Icon name="arrow_left" size={15} />
        All reports
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">
            {doc.file_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="primary" icon="file">
              {doc.doc_type ? titleCase(doc.doc_type) : "Report"}
            </Badge>
            <Meta>
              Uploaded {fullDate(doc.uploaded_at)}
              {doc.size_bytes ? ` · ${bytes(doc.size_bytes)}` : ""}
            </Meta>
          </div>
        </div>
        <Button icon="print" onClick={() => window.print()} className="no-print shrink-0">
          Print or save as PDF
        </Button>
      </header>

      {/* --------------------------------------------------- at a glance */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Values read" value={doc.findings.length} icon="droplet" />
        <Stat
          label="Outside reference range"
          value={flagged.length}
          icon="alert"
          tone={flagged.length ? "warn" : "ok"}
        />
        <Stat label="Within range" value={inRange.length} icon="check" tone="ok" />
      </div>

      {flagged.length ? (
        <Alert tone="warn" title={`${plural(flagged.length, "value")} outside the reference range`}>
          A value outside the range is not automatically a problem. Reference ranges vary between
          laboratories, and only a doctor can say what it means for you.
        </Alert>
      ) : doc.findings.length ? (
        <Alert tone="ok" title="All read values are within their reference range">
          That is reassuring, but it does not rule out a condition on its own.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section>
            <SectionTitle icon="droplet">What was measured</SectionTitle>
            {doc.findings.length ? (
              <DocumentFindings doc={doc} />
            ) : (
              <NoFindings docName={doc.file_name} />
            )}
          </section>

          {doc.impressions.length ? (
            <section>
              <SectionTitle
                icon="search"
                description="As written on the report, or as summarised from it"
              >
                The report&rsquo;s own impression
              </SectionTitle>
              <Card>
                <ul className="divide-y divide-line">
                  {doc.impressions.map((impression, i) => (
                    <li key={i} className="px-5 py-3.5">
                      <p className="text-[14.5px] leading-relaxed text-ink/85">{impression}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </div>

        {/* ------------------------------------------------------ aside */}
        <aside className="space-y-5">
          {doc.reported_medications.length ? (
            <Card>
              <div className="p-5">
                <h2 className="text-[14.5px] font-semibold text-ink">Medicines on this report</h2>
                <ul className="mt-3 space-y-2">
                  {doc.reported_medications.map((med, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <Icon name="pill" size={15} className="shrink-0 text-primary" />
                      <span className="text-[13.5px] text-ink/85">{med}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3.5 text-[12px] leading-relaxed text-faint">
                  Add these to your profile so CareFlow can check them together.
                </p>
                <LinkButton href="/profile" tone="secondary" size="sm" className="mt-3 w-full">
                  Update profile
                </LinkButton>
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="p-5">
              <h2 className="text-[14.5px] font-semibold text-ink">What does this mean?</h2>
              <dl className="mt-3 space-y-3 text-[13px] leading-relaxed">
                {[
                  {
                    t: "What was measured",
                    d: "Each row is a test the laboratory performed, named the way it appears on your report.",
                  },
                  {
                    t: "Your result",
                    d: "The value the lab recorded for you, in the unit they used.",
                  },
                  {
                    t: "Reference range",
                    d: "The range that laboratory considers typical for healthy people. Roughly 95% of healthy results fall inside it.",
                  },
                  {
                    t: "Status",
                    d: "Whether your value sits inside or outside that range. Being outside is information, not a diagnosis.",
                  },
                ].map((row) => (
                  <div key={row.t}>
                    <dt className="font-medium text-ink">{row.t}</dt>
                    <dd className="mt-0.5 text-muted">{row.d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>

          <Card className="bg-primary-soft/50">
            <div className={cx("p-5")}>
              <h2 className="text-[14.5px] font-semibold text-primary-text">
                Get this report explained
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/75">
                CareFlow can interpret this report alongside your symptoms and current medicines.
              </p>
              <LinkButton
                href="/analysis"
                tone="primary"
                size="sm"
                icon="activity"
                className="mt-3.5 w-full"
              >
                Start an analysis
              </LinkButton>
            </div>
          </Card>

          <Disclaimer />
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: "droplet" | "alert" | "check";
  tone?: "neutral" | "warn" | "ok";
}) {
  const tones = {
    neutral: "text-ink",
    warn: "text-warn-text",
    ok: "text-ok-text",
  };
  return (
    <Card>
      <div className="flex items-center gap-3 p-4">
        <Icon
          name={icon}
          size={17}
          className={cx(
            "shrink-0",
            tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-primary",
          )}
        />
        <div className="min-w-0">
          <p className={cx("text-[22px] leading-none font-semibold tabular-nums", tones[tone])}>
            {value}
          </p>
          <p className="mt-1 truncate text-[12.5px] text-muted">{label}</p>
        </div>
      </div>
    </Card>
  );
}
