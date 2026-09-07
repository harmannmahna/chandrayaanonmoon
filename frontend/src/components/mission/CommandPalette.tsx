import { useEffect, useMemo, useState } from "react";

type Command = { id: string; label: string; run: () => void };

export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(s));
  }, [commands, q]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose();
        else document.dispatchEvent(new CustomEvent("lunamatch:open-palette"));
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm">
      <div className="glass-strong w-full max-w-xl overflow-hidden border border-[var(--border)] shadow-2xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search commands…"
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  c.run();
                  onClose();
                }}
              >
                {c.label}
              </button>
            </li>
          ))}
          {!filtered.length ? <li className="px-3 py-4 text-sm text-[var(--muted)]">No commands</li> : null}
        </ul>
        <p className="border-t border-[var(--border)] px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Ctrl/Cmd+K · Esc to close
        </p>
      </div>
    </div>
  );
}
