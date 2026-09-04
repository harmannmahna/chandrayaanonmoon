import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/app/components/SiteHeader";
import { SpaceBackdrop } from "@/app/components/SpaceBackdrop";

export const metadata: Metadata = {
  title: "LUNA/REGISTER",
  description:
    "Multi-modal lunar image registration with sub-pixel refinement and coverage-aware matching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <div className="app-frame">
          <SpaceBackdrop />
          <SiteHeader />
          <main className="pb-16 pt-2">{children}</main>
          <footer className="site-footer mx-auto flex w-[min(1200px,92vw)] items-center justify-between py-4 text-[10px] uppercase tracking-[0.12em] mono">
            <span>LUNA/REGISTER · Prototype</span>
            <span>Not an official ISRO product</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
