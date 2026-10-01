"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { Badge, Card, EmptyState, RangeBar, cx } from "./ui";
import { labStatusMeta } from "../lib/format";
import type { ExtractedFinding, LabInterpretation, StoredDocument } from "../lib/types";

/** OCR flags arrive as "H", "high", "HIGH", "N", "critical low"… — normalise once. */
export function normaliseFlag(flag: string | null | undefined): string {
  if (!flag) return "unknown";
  const f = flag.trim().toLowerCase();
  if (["h", "hi", "high", "↑", "elevated"].includes(f)) return "high";
  if (["l", "lo", "low", "↓", "reduced"].includes(f)) return "low";
  if (["hh", "lll", "critical", "critically high", "critically low", "panic value"].includes(f))
    return "critical";
  if (["n", "nl", "normal", "within range", "ok", "negative"].includes(f)) return "normal";
  return "unknown";
}

export function parseNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const m = String(value).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** "3.5 – 9.5", "3.5-9.5", "<5.0", ">40" → { low, high } where available. */
export function parseRange(
  range: string | null | undefined,
): { low: number | null; high: number | null; openLow: boolean; openHigh: boolean } {
  const out = { low: null as number | null, high: null as number | null, openLow: false, openHigh: false };
  if (!range) return out;
  const text = String(range).replace(/,/g, "").trim();

  const less = text.match(/<\s*(-?\d+(?:\.\d+)?)/);
  if (less) {
    out.high = Number(less[1]);
    out.openLow = true;
    return out;
  }
  const more = text.match(/>\s*(-?\d+(?:\.\d+)?)/);
  if (more) {
    out.low = Number(more[1]);
    out.openHigh = true;
    return out;
  }
  const pair = text.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/);
  if (pair) {
    out.low = Number(pair[1]);
    out.high = Number(pair[2]);
    return out;
  }
  const single = parseNumeric(text);
  if (single != null) out.high = single;
  return out;
}

function StatusPill({ status }: { status: string }) {
  const meta = labStatusMeta(status);
  return (
    <Badge tone="neutral" className={meta.badge}>
      <span className={cx("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

/* -------------------------------------------------------------- findings */

function FindingRow({ finding }: { finding: ExtractedFinding }) {
  const status = normaliseFlag(finding.flag);
  const meta = labStatusMeta(status);
  const numeric = parseNumeric(finding.value);
  const range = parseRange(finding.reference_range);

  return (
    <div className="border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[14.5px] font-medium text-ink">{finding.test_name}</p>
        <StatusPill status={status} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cx(
            "font-mono text-[16px] font-semibold tabular-nums",
            status === "normal" ? "text-ok-text" : meta.rank >= 3 ? "text-warn-text" : "text-ink",
          )}
        >
          {finding.value ?? "—"}
        </span>
        {finding.unit ? <span className="text-[12.5px] text-faint">{finding.unit}</span> : null}
        {finding.reference_range ? (
          <span className="text-[12.5px] text-faint">· range {finding.reference_range}</span>
        ) : null}
      </div>

      {numeric != null && range.low != null && range.high != null ? (
        <div className="mt-3 max-w-xs">
          <RangeBar low={range.low} high={range.high} value={numeric} />
        </div>
      ) : null}

      {finding.source_quote ? (
        <p className="mt-2.5 border-l-2 border-line pl-2.5 text-[12.5px] leading-relaxed text-faint italic">
          “{finding.source_quote}”
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export function LabTable({
  rows,
  caption,
}: {
  rows: LabInterpretation[];
  caption?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="flex items-start gap-2 border-b border-line bg-sunken/70 px-4 py-3">
        <Icon name="droplet" size={15} className="mt-0.5 text-primary" />
        <p className="text-[12.5px] leading-relaxed text-muted">
          {caption ??
            "Each result is compared with the reference range printed on your own report. The range is a guide, not a pass/fail line — a doctor interprets it alongside your history."}
        </p>
      </div>

      {/* Table on md+, stacked cards on mobile — not a shrunken table. */}
      <table className="hidden w-full border-collapse text-left md:table">
        <thead>
          <tr className="border-b border-line">
            <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint">
              What was measured
            </th>
            <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint">
              Your result
            </th>
            <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint">
              Reference range
            </th>
            <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const meta = labStatusMeta(row.status);
            return (
              <tr key={`${row.test_name}-${i}`} className="border-b border-line last:border-b-0 align-top">
                <td className="px-4 py-3">
                  <p className="text-[14px] font-medium text-ink">{row.test_name}</p>
                  {row.significance ? (
                    <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">
                      {row.significance}
                    </p>
                  ) : null}
                  {row.plain_urdu ? (
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint italic">
                      {row.plain_urdu}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cx(
                      "font-mono text-[15px] font-semibold",
                      meta.rank >= 3 ? "text-warn-text" : meta.rank === 0 ? "text-ok-text" : "text-ink",
                    )}
                  >
                    {row.value}
                  </span>
                  {row.unit ? (
                    <span className="ml-1 text-[12px] text-faint">{row.unit}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[13px] whitespace-nowrap text-muted">
                  {row.reference_range ?? "Not given"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={row.status ?? "unknown"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="md:hidden">
        {rows.map((row, i) => {
          const meta = labStatusMeta(row.status);
          return (
            <div key={`${row.test_name}-${i}`} className="border-b border-line px-4 py-3.5 last:border-b-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14.5px] font-medium text-ink">{row.test_name}</p>
                <StatusPill status={row.status ?? "unknown"} />
              </div>
              <p className="mt-1.5">
                <span
                  className={cx(
                    "font-mono text-[16px] font-semibold",
                    meta.rank >= 3 ? "text-warn-text" : meta.rank === 0 ? "text-ok-text" : "text-ink",
                  )}
                >
                  {row.value}
                </span>
                {row.unit ? <span className="ml-1 text-[12.5px] text-faint">{row.unit}</span> : null}
                <span className="mt-0.5 block text-[12.5px] text-faint">
                  Range {row.reference_range ?? "not given"}
                </span>
              </p>
              {row.significance ? (
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{row.significance}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- exports */

export function DocumentFindings({ doc }: { doc: StoredDocument }) {
  const [showAll, setShowAll] = useState(false);
  const findings = doc.findings ?? [];
  if (!findings.length) return null;
  const visible = showAll ? findings : findings.slice(0, 6);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <h3 className="text-[14.5px] font-semibold text-ink">Values read from this report</h3>
          <p className="mt-1 text-[12.5px] text-muted">
            {findings.length} {findings.length === 1 ? "value" : "values"} extracted by CareFlow
          </p>
        </div>
        <StatusPill status={normaliseFlag(findings.find((f) => f.flag)?.flag)} />
      </div>
      <div className="border-t border-line">
        {visible.map((finding, i) => (
          <FindingRow key={`${finding.test_name}-${i}`} finding={finding} />
        ))}
      </div>
      {findings.length > 6 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-[13px] font-medium text-primary-text hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          {showAll ? "Show fewer" : `Show all ${findings.length} values`}
          <Icon
            name="chevron_down"
            size={14}
            className={cx("transition-transform", showAll && "rotate-180")}
          />
        </button>
      ) : null}
    </Card>
  );
}

export function NoFindings({ docName }: { docName: string }) {
  return (
    <EmptyState
      icon="file"
      title="No values recognised"
      body={`CareFlow could not read any measured values out of ${docName}. Try uploading a clearer scan, or describe the results in your own words.`}
    />
  );
}
