"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "../../../components/icons";
import { ResultPanel } from "../../../components/ResultPanel";
import { useCareflow } from "../../../components/CareflowProvider";
import {
  Alert,
  Button,
  LinkButton,
  Skeleton,
  cx,
} from "../../../components/ui";
import { fullDate, clockTime } from "../../../lib/format";

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useCareflow();
  const item = state.analyses.find((a) => a.id === id);

  if (!state.ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-5">
        <Alert tone="warn" title="Analysis not found">
          This summary is not stored in this browser. It may have been created on another device, or
          history may have been cleared.
        </Alert>
        <LinkButton href="/history" tone="secondary" icon="arrow_left">
          Back to history
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/history"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted no-underline hover:text-ink"
      >
        <Icon name="arrow_left" size={15} />
        All analyses
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-primary-text">
            {fullDate(item.created_at)} at {clockTime(item.created_at)}
          </p>
          <h1 className="mt-1.5 text-[24px] leading-[1.25] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
            {item.question}
          </h1>
        </div>
        <div className={cx("flex shrink-0 gap-2 no-print")}>
          <Button icon="print" onClick={() => window.print()}>
            Print
          </Button>
          <LinkButton href="/assistant" tone="soft" icon="chat">
            Ask a follow-up
          </LinkButton>
        </div>
      </header>

      <ResultPanel
        assessment={item.assessment}
        triage={item.triage}
        question={item.question}
        createdAt={item.created_at}
        documentNames={item.document_names}
      />
    </div>
  );
}
