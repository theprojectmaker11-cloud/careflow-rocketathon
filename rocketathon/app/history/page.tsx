"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../../components/icons";
import { Tabs } from "../../components/interactive";
import { useCareflow } from "../../components/CareflowProvider";
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
import {
  attentionCount,
  clockTime,
  fullDate,
  plural,
  relativeTime,
  triageMeta,
  truncate,
} from "../../lib/format";

type Filter = "all" | "urgent" | "reports";

export default function HistoryPage() {
  const { state, removeAnalysis, resetHistory } = useCareflow();
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmReset, setConfirmReset] = useState(false);

  const analyses = state.analyses;
  const urgentCount = analyses.filter((a) =>
    ["emergency", "urgent"].includes(a.triage.level),
  ).length;
  const withDocs = analyses.filter((a) => a.document_ids.length).length;

  const visible = (() => {
    if (filter === "urgent") {
      return analyses.filter((a) => ["emergency", "urgent"].includes(a.triage.level));
    }
    if (filter === "reports") return analyses.filter((a) => a.document_ids.length);
    return analyses;
  })();

  if (!state.ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="History"
        title="Past analyses"
        description="Every summary CareFlow has produced on this device. Reopen one to read it again or print it for an appointment."
        actions={
          analyses.length ? (
            confirmReset ? (
              <span className="flex items-center gap-2">
                <Button
                  tone="danger"
                  size="sm"
                  onClick={() => {
                    resetHistory();
                    setConfirmReset(false);
                  }}
                >
                  Confirm clear all
                </Button>
                <Button size="sm" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button icon="trash" onClick={() => setConfirmReset(true)}>
                Clear history
              </Button>
            )
          ) : undefined
        }
      />

      {analyses.length ? (
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { key: "all" as const, label: "All", count: analyses.length },
            {
              key: "urgent" as const,
              label: "Urgent",
              count: urgentCount,
              icon: "alert",
            },
            { key: "reports" as const, label: "With a report", count: withDocs, icon: "file" },
          ]}
        />
      ) : null}

      {analyses.length === 0 ? (
        <EmptyState
          icon="clock"
          title="Your analyses will appear here"
          body="Once you describe symptoms or upload a report, the resulting summary is saved on this device so you can come back to it."
          action={
            <LinkButton href="/analysis" tone="primary" icon="plus">
              Start health analysis
            </LinkButton>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="check"
          title="Nothing in this category"
          body="Try a different filter to see your other analyses."
          action={
            <Button tone="secondary" onClick={() => setFilter("all")}>
              Show all
            </Button>
          }
        />
      ) : (
        <ul className="stagger space-y-3">
          {visible.map((item) => {
            const meta = triageMeta(item.triage.level);
            const flagged = attentionCount(
              (item.assessment.lab_results ?? []).map((r) => r.status),
            );
            return (
              <Card key={item.id} as="li" interactive>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <Link href={`/history/${item.id}`} className="min-w-0 flex-1 no-underline">
                    <div className="flex items-start gap-3">
                      <span
                        className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", meta.dot)}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-[15px] leading-snug font-medium text-ink">
                          {truncate(item.question, 150)}
                        </p>
                        <p className="mt-1.5 text-[12.5px] text-faint">
                          {fullDate(item.created_at)} at {clockTime(item.created_at)} ·{" "}
                          {relativeTime(item.created_at)}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <Badge tone="neutral" className={meta.badge}>
                            {meta.label}
                          </Badge>
                          {flagged ? (
                            <Badge tone="warn" icon="alert">
                              {plural(flagged, "result")} to review
                            </Badge>
                          ) : null}
                          {item.document_names.length ? (
                            <Badge tone="primary" icon="file">
                              {plural(item.document_names.length, "report")}
                            </Badge>
                          ) : null}
                          {item.assessment.requires_consultation ? (
                            <Badge tone="neutral" icon="stethoscope">
                              Consult a doctor
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
                    <LinkButton href={`/history/${item.id}`} tone="secondary" size="sm">
                      Open
                    </LinkButton>
                    <button
                      type="button"
                      onClick={() => removeAnalysis(item.id)}
                      aria-label="Delete this analysis from history"
                      className="text-[12.5px] font-medium text-faint hover:text-alert-text"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      {analyses.length ? (
        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-faint">
          <Icon name="lock" size={14} className="mt-px shrink-0" />
          History is stored in this browser only. Clearing your browser data, or using a different
          device, will not show these summaries.
        </p>
      ) : null}
    </div>
  );
}
