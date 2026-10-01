"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../../components/icons";
import { Tabs } from "../../components/interactive";
import { DocumentTypeChip } from "../../components/UploadPanel";
import { useCareflow } from "../../components/CareflowProvider";
import { normaliseFlag } from "../../components/ReportTable";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Skeleton,
  cx,
} from "../../components/ui";
import { bytes, fullDate, labStatusMeta, plural, relativeTime } from "../../lib/format";

type Filter = "all" | "flagged";

export default function ReportsPage() {
  const { state, removeDocument } = useCareflow();
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const documents = state.documents;
  const flaggedCount = documents.filter(
    (d) => d.findings.some((f) => labStatusMeta(normaliseFlag(f.flag)).rank >= 3),
  ).length;

  const visible = filter === "flagged" ? documents.filter((d) =>
    d.findings.some((f) => labStatusMeta(normaliseFlag(f.flag)).rank >= 3),
  ) : documents;

  if (!state.ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Your test reports"
        description="Every report you have uploaded, with the values CareFlow read out of it."
        actions={
          <LinkButton href="/analysis?step=reports" tone="primary" icon="upload">
            Upload a report
          </LinkButton>
        }
      />

      {documents.length ? (
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { key: "all" as const, label: "All reports", count: documents.length, icon: "file" },
            {
              key: "flagged" as const,
              label: "Needs review",
              count: flaggedCount,
              icon: "alert",
            },
          ]}
        />
      ) : null}

      {documents.length === 0 ? (
        <EmptyState
          icon="file"
          title="No reports uploaded yet"
          body="Upload a test report and CareFlow will read the values, compare them with the reference ranges on the report, and explain what stands out."
          action={
            <LinkButton href="/analysis?step=reports" tone="primary" size="lg" icon="upload">
              Upload your first test report
            </LinkButton>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="check"
          title="Nothing needs review"
          body="None of your uploaded reports have values outside their reference range."
          action={
            <Button tone="secondary" onClick={() => setFilter("all")}>
              Show all reports
            </Button>
          }
        />
      ) : (
        <ul className="stagger grid gap-3.5 sm:grid-cols-2">
          {visible.map((doc) => {
            const flagged = doc.findings.filter(
              (f) => labStatusMeta(normaliseFlag(f.flag)).rank >= 3,
            );
            return (
              <Card key={doc.id} as="li" interactive className="flex flex-col overflow-hidden">
                <Link href={`/reports/${doc.id}`} className="flex-1 p-5 no-underline">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                      <Icon name="file" size={18} />
                    </span>
                    <DocumentTypeChip type={doc.doc_type} />
                  </div>

                  <h2 className="mt-3.5 truncate text-[15px] font-semibold text-ink">
                    {doc.file_name}
                  </h2>
                  <p className="mt-1 text-[12.5px] text-faint">
                    Uploaded {relativeTime(doc.uploaded_at)} · {bytes(doc.size_bytes)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{plural(doc.findings.length, "value")}</Badge>
                    {flagged.length ? (
                      <Badge tone="warn" icon="alert">
                        {plural(flagged.length, "value")} to review
                      </Badge>
                    ) : doc.findings.length ? (
                      <Badge tone="ok" icon="check">
                        In range
                      </Badge>
                    ) : null}
                    {doc.reported_medications.length ? (
                      <Badge tone="primary" icon="pill">
                        {plural(doc.reported_medications.length, "medicine")}
                      </Badge>
                    ) : null}
                  </div>

                  {doc.impressions.length ? (
                    <p className="mt-3 line-clamp-2 border-l-2 border-line pl-3 text-[12.5px] leading-relaxed text-muted italic">
                      “{doc.impressions[0]}”
                    </p>
                  ) : null}
                </Link>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line px-5 py-2.5">
                  <span className="text-[12px] text-faint">{fullDate(doc.uploaded_at)}</span>
                  {confirmId === doc.id ? (
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          removeDocument(doc.id);
                          setConfirmId(null);
                        }}
                        className="text-[12.5px] font-medium text-alert-text hover:underline"
                      >
                        Confirm remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-[12.5px] font-medium text-muted hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(doc.id)}
                      aria-label={`Remove ${doc.file_name}`}
                      className={cx(
                        "text-[12.5px] font-medium text-faint hover:text-alert-text",
                      )}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
