/**
 * CareFlow UI primitives — presentational only, no "use client".
 * These render on the server AND inside client components, so pages stay
 * free to be server-rendered where they don't need interactivity.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */

type ButtonTone = "primary" | "secondary" | "soft" | "ghost" | "danger" | "warning";
type ButtonSize = "sm" | "md" | "lg";

const BTN_TONE: Record<ButtonTone, string> = {
  primary:
    "bg-primary text-inverse border-transparent hover:bg-primary-strong active:bg-primary-strong shadow-card",
  secondary:
    "bg-surface text-ink border-line hover:bg-sunken hover:border-line-strong active:bg-sunken shadow-card",
  soft: "bg-primary-soft text-primary-text border-primary-line hover:bg-[#dcecee] active:bg-[#d5e8eb]",
  ghost: "bg-transparent text-muted border-transparent hover:bg-sunken hover:text-ink",
  danger: "bg-alert text-inverse border-transparent hover:bg-alert-text active:bg-alert-text shadow-card",
  warning: "bg-warn-soft text-warn-text border-warn-line hover:bg-[#fdf0d3] active:bg-[#fceac4]",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[8px]",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-[11px]",
};

export function Button({
  children,
  tone = "secondary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  className,
  ...rest
}: {
  children?: ReactNode;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center border font-medium whitespace-nowrap select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-55",
        BTN_TONE[tone],
        BTN_SIZE[size],
        className,
      )}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === "sm" ? 13 : 15} />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 14 : 16} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === "sm" ? 14 : 16} /> : null}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  tone = "secondary",
  size = "md",
  icon,
  iconRight,
  className,
}: {
  children?: ReactNode;
  href: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center border font-medium whitespace-nowrap no-underline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        BTN_TONE[tone],
        BTN_SIZE[size],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={size === "sm" ? 14 : 16} /> : null}
    </Link>
  );
}

export function IconButton({
  name,
  label,
  size = 18,
  className,
  ...rest
}: {
  name: IconName;
  label: string;
  size?: number;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-control border border-transparent",
        "text-muted hover:bg-sunken hover:text-ink active:bg-sunken",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cx("spin", className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.6" opacity="0.22" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  className = "",
  as: As = "div",
  interactive = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  interactive?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={cx(
        "rounded-card border border-line bg-surface shadow-card",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-150 hover:border-line-strong hover:shadow-raised",
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("px-5 pt-5 pb-4", className)}>{children}</div>;
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("px-5 pb-5", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 border-t border-line bg-sunken/60 px-5 py-3.5 text-[13px] text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */

export type Tone = "neutral" | "primary" | "ok" | "warn" | "alert" | "info";

const BADGE: Record<Tone, string> = {
  neutral: "bg-sunken text-muted border-line",
  primary: "bg-primary-soft text-primary-text border-primary-line",
  ok: "bg-ok-soft text-ok-text border-ok-line",
  warn: "bg-warn-soft text-warn-text border-warn-line",
  alert: "bg-alert-soft text-alert-text border-alert-line",
  info: "bg-info-soft text-info-text border-info-line",
};

export function Badge({
  children,
  tone = "neutral",
  icon,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: IconName;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[12px] font-medium leading-5",
        BADGE[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} strokeWidth={2} /> : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- Headings */

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cx(
        "text-[11px] font-semibold uppercase tracking-[0.09em] text-faint",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow> : null}
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({
  children,
  description,
  icon,
  action,
  className = "",
}: {
  children: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {icon ? <Icon name={icon} size={17} className="text-primary" /> : null}
          {children}
        </h2>
        {description ? (
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- Alert */

const ALERT_TONE: Record<Tone, { wrap: string; icon: IconName; title: string }> = {
  info: { wrap: "bg-info-soft border-info-line", icon: "info", title: "text-info-text" },
  ok: { wrap: "bg-ok-soft border-ok-line", icon: "check_small", title: "text-ok-text" },
  warn: { wrap: "bg-warn-soft border-warn-line", icon: "alert", title: "text-warn-text" },
  alert: { wrap: "bg-alert-soft border-alert-line", icon: "alert", title: "text-alert-text" },
  primary: { wrap: "bg-primary-soft border-primary-line", icon: "info", title: "text-primary-text" },
  neutral: { wrap: "bg-sunken border-line", icon: "info", title: "text-ink" },
};

/**
 * Status banner. Urgent tone is reserved for genuinely urgent clinical
 * states — it is the loudest thing on the page by design.
 */
export function Alert({
  tone = "info",
  title,
  children,
  icon,
  action,
  className = "",
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}) {
  const t = ALERT_TONE[tone];
  return (
    <div
      className={cx(
        "flex gap-3 rounded-card border px-4 py-3.5",
        t.wrap,
        tone === "alert" && "shadow-[0_1px_2px_rgb(180_35_24/0.06)]",
        className,
      )}
      role={tone === "alert" ? "alert" : "note"}
    >
      <Icon name={icon ?? t.icon} size={17} className={cx("mt-0.5", t.title)} strokeWidth={1.9} />
      <div className="min-w-0 flex-1">
        {title ? (
          <p className={cx("text-[14px] font-semibold", t.title)}>{title}</p>
        ) : null}
        {children ? (
          <div className={cx("text-[13.5px] leading-relaxed text-ink/80", Boolean(title) && "mt-1")}>
            {children}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

/** The medical-advice disclaimer. Deliberately always visible, never dismissible. */
export function Disclaimer({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <p
      className={cx(
        "flex items-start gap-2 text-[12.5px] leading-relaxed text-faint",
        className,
      )}
    >
      <Icon name="shield" size={14} className="mt-px shrink-0" />
      <span>
        CareFlow provides AI-assisted health information and does not replace professional
        medical advice. Always confirm with a qualified clinician.
        {compact ? null : " This is not a diagnosis."}
      </span>
    </p>
  );
}

/* ----------------------------------------------------------------- Skeleton */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("skeleton rounded-md", className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={cx("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cx("h-3.5", i === lines - 1 ? "w-2/5" : i % 2 ? "w-11/12" : "w-full")}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- EmptyState */

export function EmptyState({
  icon = "inbox",
  title,
  body,
  action,
  className = "",
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-11 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name={icon} size={20} />
      </div>
      <p className="mt-3.5 text-[15px] font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Fields */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13.5px] font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-alert">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-alert-text">
          <Icon name="alert" size={13} />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] leading-relaxed text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-3.5 text-[14px] text-ink placeholder:text-faint " +
  "hover:border-line-strong focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 " +
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-faint";

export function Input({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, "h-10", className)} {...rest} />;
}

export function Textarea({
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea className={cx(CONTROL, "resize-y py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(CONTROL, "h-10 cursor-pointer pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

/** Controlled switch. Tone `primary` unless the setting is safety-relevant. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  tone = "primary",
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  tone?: "primary" | "warn";
  id?: string;
}) {
  const on = tone === "warn" ? "bg-warn" : "bg-primary";
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-pill border border-transparent",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          checked ? on : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- Range meter */

/**
 * Where a measured value sits inside its reference range.
 * Position is marked by a dot AND the label, never colour alone.
 */
export function RangeBar({
  low,
  high,
  value,
  lowLabel = "Low",
  highLabel = "High",
}: {
  low: number;
  high: number;
  value: number;
  lowLabel?: string;
  highLabel?: string;
}) {
  const span = high - low || 1;
  const pct = Math.max(0, Math.min(100, ((value - low) / span) * 100));
  const out = value < low || value > high;
  return (
    <div>
      <div className="relative h-2 w-full rounded-pill bg-sunken">
        <div className="absolute inset-y-0 left-[28%] right-[28%] rounded-pill bg-ok-line" />
        <div
          className={cx(
            "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm",
            out ? "bg-alert" : "bg-ok",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{lowLabel}</span>
        <span>Reference range</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- Misc */

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}

export function Meta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[12.5px] text-faint", className)}>{children}</p>;
}
