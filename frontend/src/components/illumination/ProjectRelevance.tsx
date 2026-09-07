import { Link } from "react-router-dom";
import { GlassCard } from "../GlassCard";

export function ProjectRelevance() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="space-y-3">
          <p className="kicker">LUNA/REGISTER</p>
          <h3 className="text-xl font-semibold">Why illumination affects matching</h3>
          <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
            <li>• Different Sun elevation/azimuth changes crater brightness and shadows.</li>
            <li>• The same physical point may look visually different.</li>
            <li>• Shadow edges can create false correspondence candidates.</li>
            <li>
              • Existing registration workflow responds with: CLAHE → matching → RANSAC → quality metrics.
            </li>
          </ul>
          <Link to="/register" className="btn btn-primary !min-h-9 text-xs">
            Go to Register
          </Link>
        </GlassCard>

        <GlassCard className="space-y-3">
          <p className="kicker">LUNA/ICE</p>
          <h3 className="text-xl font-semibold">Why illumination affects missions</h3>
          <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
            <li>• Shadowed terrain can be relevant to cold-trap/ice-target context.</li>
            <li>• A safe landing site often prefers flatter and better illuminated terrain.</li>
            <li>• A rover route must balance target access, slope, hazards, and solar exposure.</li>
            <li>
              • Existing LUNA/ICE workflow responds with: radar evidence → landing suitability → solar-aware route → volume
              scenarios.
            </li>
          </ul>
          <Link to="/ice" className="btn btn-primary !min-h-9 text-xs">
            Go to Ice Planner
          </Link>
        </GlassCard>
      </div>

      <GlassCard className="overflow-x-auto">
        <p className="kicker mb-3">Comparison</p>
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <th className="px-3 py-2">Topic</th>
              <th className="px-3 py-2">LUNA/REGISTER</th>
              <th className="px-3 py-2">LUNA/ICE</th>
            </tr>
          </thead>
          <tbody className="text-[var(--muted)]">
            {[
              ["Sun effect", "Changes image brightness and shadow geometry", "Changes solar access, cold-trap context, and route risk"],
              ["Main challenge", "Weak/false visual correspondences", "Balance science access, terrain safety, and energy"],
              ["Prototype response", "Matching + RANSAC + quality warning", "Suitability score + solar-aware route"],
              ["Key output", "Registered image and match points", "Ice evidence, landing candidate, and rover path"],
            ].map(([topic, reg, ice]) => (
              <tr key={topic} className="border-b border-[var(--border)]">
                <td className="px-3 py-3 font-medium text-[var(--text)]">{topic}</td>
                <td className="px-3 py-3">{reg}</td>
                <td className="px-3 py-3">{ice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
