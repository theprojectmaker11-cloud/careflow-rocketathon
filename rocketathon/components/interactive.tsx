"use client";

/** Stateful primitives: anything that needs hooks lives here. */

import { useId, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { cx } from "./ui";

/* ------------------------------------------------------------- ProgressSteps */

export function ProgressSteps({
  steps,
  current,
  onJump,
}: {
  steps: { key: string; label: string; hint?: string }[];
  current: number;
  onJump?: (index: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-1" aria-label="Progress">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= current && Boolean(onJump);
        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onJump?.(i)}
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2.5 py-2 text-left",
                reachable && "hover:bg-sunken",
                !reachable && "cursor-default",
              )}
            >
              <span
                className={cx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-semibold",
                  done && "border-primary bg-primary text-inverse",
                  active && "border-primary bg-primary-soft text-primary-text",
                  !done && !active && "border-line-strong bg-surface text-faint",
                )}
              >
                {done ? <Icon name="check" size={12} strokeWidth={2.6} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cx(
                    "block truncate text-[13.5px] font-medium",
                    active ? "text-ink" : done ? "text-primary-text" : "text-faint",
                  )}
                >
                  {step.label}
                </span>
                {step.hint ? (
                  <span className="block truncate text-[11.5px] text-faint">{step.hint}</span>
                ) : null}
              </span>
            </button>
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cx(
                  "hidden h-px w-4 shrink-0 sm:block",
                  done ? "bg-primary-line" : "bg-line",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: { key: T; label: string; count?: number; icon?: IconName }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        "flex gap-1 overflow-x-auto rounded-[11px] border border-line bg-sunken p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13.5px] font-medium",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
              active
                ? "bg-surface text-ink shadow-card"
                : "text-muted hover:text-ink",
            )}
          >
            {tab.icon ? <Icon name={tab.icon} size={14} /> : null}
            {tab.label}
            {typeof tab.count === "number" ? (
              <span
                className={cx(
                  "rounded-pill px-1.5 text-[11px] font-semibold",
                  active ? "bg-primary-soft text-primary-text" : "bg-line text-muted",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Accordion */

export function Accordion({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  badge,
  children,
  tone = "neutral",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  tone?: "neutral" | "warn" | "alert";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const edge =
    tone === "alert"
      ? "border-alert-line bg-alert-soft/40"
      : tone === "warn"
        ? "border-warn-line bg-warn-soft/40"
        : "border-line";

  return (
    <div className={cx("overflow-hidden rounded-card border", edge)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-sunken/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        {icon ? (
          <span
            className={cx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-control",
              tone === "alert"
                ? "bg-alert-soft text-alert"
                : tone === "warn"
                  ? "bg-warn-soft text-warn"
                  : "bg-primary-soft text-primary",
            )}
          >
            <Icon name={icon} size={16} />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-ink">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{subtitle}</span>
          ) : null}
        </span>
        {badge}
        <Icon
          name="chevron_down"
          size={16}
          className={cx("shrink-0 text-faint transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <div id={id} hidden={!open} className="border-t border-line bg-surface px-4 py-4">
        {children}
      </div>
    </div>
  );
}
