"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, Logo, type IconName } from "./icons";
import { cx, Disclaimer } from "./ui";
import { useCareflow } from "./CareflowProvider";
import { initials } from "../lib/format";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  description: string;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home", description: "Your health overview" },
  { href: "/analysis", label: "Health analysis", icon: "activity", description: "Analyse symptoms or a report" },
  { href: "/reports", label: "Reports", icon: "file", description: "Uploaded test reports" },
  { href: "/history", label: "History", icon: "clock", description: "Past analyses and chats" },
  { href: "/assistant", label: "Assistant", icon: "chat", description: "Ask follow-up questions" },
  { href: "/profile", label: "Profile", icon: "user", description: "Details and preferences" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium no-underline",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
              active
                ? "bg-primary-soft text-primary-text"
                : "text-muted hover:bg-sunken hover:text-ink",
            )}
          >
            <Icon
              name={item.icon}
              size={18}
              strokeWidth={active ? 2 : 1.6}
              className={active ? "text-primary" : "text-faint group-hover:text-muted"}
            />
            <span className="min-w-0">
              <span className="block truncate leading-tight">{item.label}</span>
              <span
                className={cx(
                  "mt-0.5 block truncate text-[11.5px] font-normal leading-tight",
                  active ? "text-primary-text/70" : "text-faint",
                )}
              >
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-[10px] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Logo size={compact ? 28 : 30} />
      <span className="leading-none">
        <span className="block text-[16.5px] font-semibold tracking-[-0.02em] text-ink">CareFlow</span>
        <span className="mt-0.5 block text-[11px] font-medium tracking-[0.04em] text-faint uppercase">
          Health companion
        </span>
      </span>
    </Link>
  );
}

function Avatar() {
  const { state } = useCareflow();
  const name = state.profile.full_name;
  return (
    <Link
      href="/profile"
      aria-label={name ? `Profile for ${name}` : "Set up your profile"}
      className={cx(
        "flex h-8 w-8 items-center justify-center rounded-full border border-primary-line",
        "bg-primary-soft text-[12px] font-semibold text-primary-text",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      )}
    >
      {name ? initials(name) : <Icon name="plus" size={14} />}
    </Link>
  );
}

/** Shown only when the analysis service is genuinely unreachable. */
function BackendNotice() {
  const { backend } = useCareflow();
  if (backend !== "offline") return null;
  return (
    <div
      role="status"
      className="border-b border-warn-line bg-warn-soft px-4 py-2.5 text-[12.5px] text-warn-text sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-2">
        <Icon name="alert" size={15} className="mt-px shrink-0" />
        <p>
          <span className="font-semibold">Analysis service offline.</span> Browsing still works,
          but new analyses and report uploads need the FastAPI service running
          ({" "}
          <code className="rounded bg-warn/10 px-1 py-px font-mono text-[11.5px]">
            uvicorn main:app --reload
          </code>
          ).
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  // Esc to dismiss, and lock scroll behind the overlay.
  useEffect(() => {
    if (!drawer) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawer(false);
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [drawer]);

  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* ------------------------------------------------ desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>

        <div className="px-3">
          <Link
            href="/analysis"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-control border border-transparent bg-primary text-[14px] font-medium text-inverse no-underline shadow-card hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon name="plus" size={16} strokeWidth={2.2} />
            New analysis
          </Link>
        </div>

        <div className="mt-5 flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>

        <div className="border-t border-line px-5 py-4">
          <Disclaimer compact />
        </div>
      </aside>

      {/* -------------------------------------------------- mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm lg:hidden">
        <IconButtonMenu onClick={() => setDrawer(true)} />
        <Brand compact />
        <Avatar />
      </header>

      {/* ---------------------------------------------------- mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px] animate-fade-in"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[286px] max-w-[85vw] flex-col border-r border-line bg-surface shadow-pop"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="px-3">
              <Link
                href="/analysis"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-control bg-primary text-[14px] font-medium text-inverse no-underline hover:bg-primary-strong"
              >
                <Icon name="plus" size={16} strokeWidth={2.2} />
                New analysis
              </Link>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto px-3">
              <NavLinks onNavigate={() => setDrawer(false)} />
            </div>

            <div className="border-t border-line px-5 py-4">
              <Disclaimer compact />
            </div>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------------- content */}
      <div className="lg:pl-[248px]">
        <BackendNotice />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function IconButtonMenu({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open navigation"
      className="-ml-1 flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon name="menu" size={20} />
    </button>
  );
}
