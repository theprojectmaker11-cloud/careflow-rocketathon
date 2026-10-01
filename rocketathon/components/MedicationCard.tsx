"use client";

import { Icon } from "./icons";
import { Accordion } from "./interactive";
import { Badge, cx } from "./ui";
import { MED_ROLE, VERDICT } from "../lib/format";
import type { MedicationSafetyItem } from "../lib/types";

/**
 * Medication cards are deliberately the most cautious UI in the app.
 * The verdict badge is never green-on-its-own phrasing like "Safe" — every
 * verdict carries a "confirm with a doctor" line, because a chat assistant
 * cannot authorise a prescription.
 */
export function MedicationCard({ item }: { item: MedicationSafetyItem }) {
  const v = VERDICT[item.verdict] ?? VERDICT.insufficient_information;
  const urgent = item.verdict === "unsafe" || item.verdict === "contraindicated";
  const cautious = item.verdict === "needs_review";

  return (
    <Accordion
      tone={urgent ? "alert" : cautious ? "warn" : "neutral"}
      icon="pill"
      title={<span className="text-ink">{item.medication}</span>}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{MED_ROLE[item.role] ?? "Mentioned in your case"}</span>
        </span>
      }
      badge={<Badge tone="neutral" className={v.badge}>{v.label}</Badge>}
    >
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-muted">{v.blurb}</p>

        {item.reasons.length ? (
          <div>
            <h4 className="mb-1.5 text-[12px] font-semibold tracking-[0.05em] text-faint uppercase">
              Why
            </h4>
            <ul className="space-y-1.5">
              {item.reasons.map((reason, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-ink/85">
                  <span
                    className={cx(
                      "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
                      urgent ? "bg-alert" : cautious ? "bg-warn" : "bg-ok",
                    )}
                    aria-hidden="true"
                  />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {item.safer_alternatives.length ? (
          <div>
            <h4 className="mb-1.5 text-[12px] font-semibold tracking-[0.05em] text-faint uppercase">
              Options a doctor might consider
            </h4>
            <ul className="space-y-1.5">
              {item.safer_alternatives.map((alt, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-ink/85">
                  <Icon name="chevron_right" size={14} className="mt-0.5 shrink-0 text-faint" />
                  {alt}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {item.pharmacist_question ? (
          <div className="rounded-control border border-info-line bg-info-soft px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-info-text">
              <Icon name="chat" size={13} />
              Ask your pharmacist this
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink/85">“{item.pharmacist_question}”</p>
          </div>
        ) : null}

        {/* Non-negotiable: nothing here is a prescription. */}
        <p
          className={cx(
            "flex items-start gap-2 rounded-control border px-3.5 py-3 text-[12.5px] leading-relaxed",
            item.must_confirm_with_doctor
              ? "border-warn-line bg-warn-soft text-warn-text"
              : "border-line bg-sunken text-muted",
          )}
        >
          <Icon name="stethoscope" size={15} className="mt-px shrink-0" />
          <span>
            {item.must_confirm_with_doctor
              ? "Confirm with a doctor or pharmacist before starting, stopping, or changing this medicine."
              : "Do not start, stop, or change any medicine based on this summary."}
          </span>
        </p>
      </div>
    </Accordion>
  );
}

export function MedicationList({ items }: { items: MedicationSafetyItem[] }) {
  if (!items.length) return null;
  // Most urgent first, then uncertain-before-fine.
  const rank: Record<string, number> = {
    contraindicated: 0,
    unsafe: 1,
    insufficient_information: 2,
    needs_review: 3,
    appropriate: 4,
  };
  const sorted = [...items].sort((a, b) => (rank[a.verdict] ?? 9) - (rank[b.verdict] ?? 9));

  return (
    <div className="space-y-2.5">
      {sorted.map((item, i) => (
        <MedicationCard key={`${item.medication}-${i}`} item={item} />
      ))}
    </div>
  );
}
