"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import { Skeleton, SkeletonText, cx } from "./ui";

/** Honest progress messaging: we cannot know the server's real progress, so
 *  we describe the stages the pipeline actually goes through. */
const STAGES: { label: string; detail: string; icon: IconName }[] = [
  { label: "Reading your message", detail: "Noting symptoms, timing and severity", icon: "chat" },
  { label: "Reviewing the information you provided", detail: "Checking uploaded reports for measured values", icon: "file" },
  { label: "Screening for warning signs", detail: "Checking whether anything needs urgent attention", icon: "alert" },
  { label: "Checking medicines and interactions", detail: "Comparing anything you take against your reports", icon: "pill" },
  { label: "Preparing your summary", detail: "Writing this up section by section", icon: "activity" },
];

export function AnalysisLoading({ compact = false }: { compact?: boolean }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 py-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" className="spin" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.2" />
            <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <p className="text-[15px] font-semibold text-ink">Analysing your information…</p>
          <p className="text-[13px] text-muted">This usually takes 20–60 seconds.</p>
        </div>
      </div>

      <ol className="space-y-1.5">
        {STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li
              key={s.label}
              className={cx(
                "flex items-center gap-2.5 rounded-control px-3 py-2 text-[13.5px] transition-opacity duration-300",
                done && "text-ok-text",
                active && "bg-primary-soft/60 font-medium text-primary-text",
                !done && !active && "text-faint",
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {done ? (
                  <Icon name="check" size={14} strokeWidth={2.4} />
                ) : active ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="hidden shrink-0 text-[12px] text-faint sm:block">{s.detail}</span>
            </li>
          );
        })}
      </ol>

      {compact ? null : (
        <div className="space-y-3 rounded-card border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13.5px] font-medium text-muted">Laying out your summary</p>
            <p className="text-[12px] text-faint">preview</p>
          </div>
          <Skeleton className="h-4 w-2/5" />
          <SkeletonText lines={3} />
          <Skeleton className="h-20 w-full rounded-card" />
        </div>
      )}
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading your health overview">
      <div className="rounded-card border border-line bg-surface p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-7 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-12" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
