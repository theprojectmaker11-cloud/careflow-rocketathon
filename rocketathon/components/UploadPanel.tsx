"use client";

/**
 * Report upload with drag-and-drop, client-side validation, and a clear
 * per-file outcome. Reused by the analysis wizard and the assistant.
 */

import { useCallback, useRef, useState } from "react";
import { Icon } from "./icons";
import { Badge, Button, Card, Spinner, cx } from "./ui";
import { toStoredDocument, uploadDocument } from "../lib/api";
import { useCareflow } from "./CareflowProvider";
import { bytes, titleCase } from "../lib/format";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_BYTES = 10 * 1024 * 1024;
const SUPPORTED = ["Lab report", "Prescription", "Imaging or scan", "Discharge summary"];

type Phase = "idle" | "uploading" | "reading" | "done" | "error";

interface Job {
  id: string;
  name: string;
  size: number;
  phase: Phase;
  error?: string;
  summary?: string;
}

export function UploadPanel({
  compact = false,
  onUploaded,
  mrn,
  age,
}: {
  compact?: boolean;
  onUploaded?: (id: string) => void;
  mrn?: string;
  age?: number;
}) {
  const { addDocument } = useCareflow();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      // One job per file, keyed by a unique id so concurrent uploads don't collide.
      const queued = Array.from(files).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        phase: "uploading" as Phase,
      }));
      setJobs((prev) => [...prev, ...queued]);

      const patch = (id: string, next: Partial<Job>) =>
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...next } : j)));

      await Promise.all(
        queued.map(async ({ id, file }) => {
          try {
            if (file.size > MAX_BYTES) {
              throw new Error(
                `That file is ${bytes(file.size)}. Please keep reports under 10 MB.`,
              );
            }
            if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) {
              throw new Error("Upload a PDF or an image (JPG, PNG, WEBP).");
            }

            patch(id, { phase: "reading" });

            const res = await uploadDocument(file, mrn, age ?? undefined);
            addDocument(toStoredDocument(file, res.document));
            onUploaded?.(res.document.id);

            patch(id, {
              phase: "done",
              summary: `${res.document.findings?.length ?? 0} values, ${
                res.document.impressions?.length ?? 0
              } notes`,
            });
          } catch (error) {
            patch(id, { phase: "error", error: (error as Error).message });
          }
        }),
      );

      if (inputRef.current) inputRef.current.value = "";
    },
    [addDocument, mrn, age, onUploaded],
  );

  const busy = jobs.some((j) => j.phase === "uploading" || j.phase === "reading");

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cx(
          "rounded-card border-2 border-dashed px-5 py-8 text-center",
          "transition-colors duration-150",
          drag ? "border-primary bg-primary-soft/50" : "border-line-strong bg-surface/60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
          id="cf-report-input"
        />
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="upload" size={20} />
        </div>
        <p className="mt-3.5 text-[15px] font-semibold text-ink">
          Drop a test report here
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
          CareFlow reads the values, compares them with the reference ranges printed on the report,
          and explains what stands out.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2.5">
          <Button
            tone="secondary"
            icon="file"
            onClick={() => inputRef.current?.click()}
            loading={busy}
          >
            {busy ? "Reading report…" : "Choose a file"}
          </Button>
          <p className="text-[12px] text-faint">PDF, JPG, PNG or WEBP · up to 10 MB</p>
        </div>

        {!compact ? (
          <ul className="mt-5 flex flex-wrap justify-center gap-1.5">
            {SUPPORTED.map((label) => (
              <li
                key={label}
                className="rounded-pill border border-line bg-surface px-2.5 py-1 text-[11.5px] text-muted"
              >
                {label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {jobs.length ? (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Card
                className={cx(
                  "flex items-center gap-3 px-4 py-3",
                  job.phase === "error" && "border-alert-line",
                )}
              >
                <span
                  className={cx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
                    job.phase === "error"
                      ? "bg-alert-soft text-alert"
                      : job.phase === "done"
                        ? "bg-ok-soft text-ok"
                        : "bg-primary-soft text-primary",
                  )}
                >
                  {job.phase === "uploading" || job.phase === "reading" ? (
                    <Spinner size={16} />
                  ) : (
                    <Icon name={job.phase === "done" ? "check" : "alert"} size={16} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{job.name}</p>
                  {job.phase === "uploading" ? (
                    <p className="text-[12.5px] text-muted">Uploading…</p>
                  ) : job.phase === "reading" ? (
                    <p className="text-[12.5px] text-muted">
                      Reading the report and extracting values…
                    </p>
                  ) : job.phase === "done" ? (
                    <p className="text-[12.5px] text-ok-text">
                      Read successfully {job.summary ? `· ${job.summary}` : ""}
                    </p>
                  ) : (
                    <p className="text-[12.5px] text-alert-text">{job.error}</p>
                  )}
                </div>
                {job.phase === "done" ? (
                  <Badge tone="ok" icon="check">
                    Ready
                  </Badge>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DocumentTypeChip({ type }: { type: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-sunken px-2.5 py-0.5 text-[11.5px] text-muted">
      <Icon name="file" size={11} />
      {type ? titleCase(type) : "Report"}
    </span>
  );
}
