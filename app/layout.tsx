import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "LUNA/REGISTER",
  description:
    "Multi-modal lunar image registration with sub-pixel refinement and coverage-aware matching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <SiteHeader />
          <main className="mx-auto w-[min(1200px,92vw)] pb-16 pt-8">{children}</main>
          <footer className="mx-auto flex w-[min(1200px,92vw)] items-center justify-between border-t border-[#292927] py-4 text-[10px] uppercase tracking-[0.12em] text-[#555] mono">
            <span>LUNA/REGISTER · Prototype</span>
            <span>Not an official ISRO product</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
