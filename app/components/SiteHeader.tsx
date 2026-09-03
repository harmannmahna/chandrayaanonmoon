"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/", label: "Register" },
  { href: "/context", label: "Context" },
];

function HeaderInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const walkthroughOpen = searchParams.get("walkthrough") === "1";

  const openWalkthrough = () => {
    router.push("/?walkthrough=1&step=0");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#292927] bg-[rgba(8,8,8,0.92)] backdrop-blur">
      <div className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Link href="/" className="mono text-sm font-semibold tracking-[0.08em]">
              LUNA<span className="text-[#d8ff3e]">/</span>REGISTER
            </Link>
            <span className="hidden rounded border border-[#393937] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#888] md:inline">
              Prototype
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-[#9a9a96]">
            Multi-modal lunar image registration with sub-pixel refinement and coverage-aware matching.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex items-center gap-1 rounded border border-[#292927] bg-[#0d0d0d] p-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-2 text-[10px] uppercase tracking-[0.1em] mono ${
                    active ? "bg-[#151515] text-white shadow-[inset_0_-1px_0_#d8ff3e]" : "text-[#777]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={openWalkthrough}
            className={`rounded border px-3 py-2 text-[10px] uppercase tracking-[0.1em] mono ${
              walkthroughOpen
                ? "border-[#d8ff3e] bg-[#151515] text-[#d8ff3e]"
                : "border-[#424240] bg-[#111] text-[#d5d5d2]"
            }`}
          >
            How to demo
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<div className="h-[88px] border-b border-[#292927]" />}>
      <HeaderInner />
    </Suspense>
  );
}
