import { AnimatePresence, motion } from "framer-motion";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { ThemeBackground } from "./components/ThemeBackground";
import { LandingPage } from "./pages/LandingPage";
import { RegistrationWizard } from "./pages/registration/RegistrationWizard";
import { IceDetectionPage } from "./pages/IceDetectionPage";
import { SolarSystemPage } from "./pages/SolarSystemPage";
import { MissionBriefingPage } from "./pages/MissionBriefingPage";
import { useAppStore } from "./store/appStore";
import { useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./components/mission/CommandPalette";

function Shell() {
  const theme = useAppStore((s) => s.theme);
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const open = () => setPaletteOpen(true);
    document.addEventListener("lunamatch:open-palette", open as EventListener);
    return () => document.removeEventListener("lunamatch:open-palette", open as EventListener);
  }, []);

  const commands = useMemo(
    () => [
      {
        id: "fast",
        label: "Run AI Fast matching",
        run: () => {
          navigate("/register");
          window.setTimeout(
            () => document.dispatchEvent(new CustomEvent("lunamatch:engine", { detail: "superpoint-lightglue" })),
            50,
          );
        },
      },
      {
        id: "robust",
        label: "Run AI Robust matching",
        run: () => {
          navigate("/register");
          window.setTimeout(() => document.dispatchEvent(new CustomEvent("lunamatch:engine", { detail: "loftr" })), 50);
        },
      },
      {
        id: "akaze",
        label: "Run AKAZE baseline",
        run: () => {
          navigate("/register");
          window.setTimeout(() => document.dispatchEvent(new CustomEvent("lunamatch:engine", { detail: "akaze" })), 50);
        },
      },
      {
        id: "compare",
        label: "Compare model runs",
        run: () => {
          navigate("/register");
          window.setTimeout(() => document.dispatchEvent(new CustomEvent("lunamatch:open-history")), 80);
        },
      },
      {
        id: "explain",
        label: "Explain registration quality",
        run: () => {
          navigate("/register");
          window.setTimeout(() => document.dispatchEvent(new CustomEvent("lunamatch:explain")), 80);
        },
      },
      { id: "illum", label: "Open Illumination Lab", run: () => navigate("/solar") },
      { id: "ice", label: "Open Ice Planner", run: () => navigate("/ice") },
      {
        id: "export",
        label: "Export results",
        run: () => {
          navigate("/register");
          window.setTimeout(() => document.dispatchEvent(new CustomEvent("lunamatch:export")), 80);
        },
      },
      { id: "home", label: "Open Landing", run: () => navigate("/") },
      { id: "briefing", label: "Open Briefing", run: () => navigate("/briefing") },
    ],
    [navigate],
  );

  return (
    <>
      <ThemeBackground />
      <div className="app-shell">
        <TopBar />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(3px)" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationWizard />} />
        <Route path="/ice" element={<IceDetectionPage />} />
        <Route path="/ice/context" element={<Navigate to="/briefing" replace />} />
        <Route path="/solar" element={<SolarSystemPage />} />
        <Route path="/illumination" element={<Navigate to="/solar" replace />} />
        <Route path="/briefing" element={<MissionBriefingPage />} />
      </Route>
    </Routes>
  );
}
