import { Link, useLocation } from "react-router-dom";
import { Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { useAmbientAudio } from "../hooks/useAmbientAudio";

export function TopBar() {
  const theme = useAppStore((s) => s.theme);
  const musicOn = useAppStore((s) => s.musicOn);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const toggleMusic = useAppStore((s) => s.toggleMusic);
  const location = useLocation();
  useAmbientAudio(musicOn);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg0)_72%,transparent)] backdrop-blur-xl">
      <div className="page flex items-center justify-between gap-4 !py-3">
        <Link to="/" className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-[0.14em] uppercase">LunaMatch</span>
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase text-[var(--muted)]">
            SIH 26166
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {[
            ["/", "Home"],
            ["/register", "Register"],
            ["/ice", "Ice"],
            ["/solar", "Solar"],
            ["/briefing", "Briefing"],
          ].map(([href, label]) => (
            <Link
              key={href}
              to={href}
              className={`rounded-full px-3 py-1.5 text-xs tracking-[0.08em] uppercase transition ${
                location.pathname === href
                  ? "text-[var(--text)] underline decoration-[var(--accent)] underline-offset-4"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary !min-h-9 !px-3"
            aria-label={musicOn ? "Mute soundtrack" : "Play soundtrack"}
            onClick={toggleMusic}
          >
            {musicOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            className="btn btn-secondary !min-h-9 !px-3"
            aria-label="Toggle dark/light mode"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
