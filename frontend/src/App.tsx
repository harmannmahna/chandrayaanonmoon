import { AnimatePresence, motion } from "framer-motion";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { ThemeBackground } from "./components/ThemeBackground";
import { LandingPage } from "./pages/LandingPage";
import { RegistrationWizard } from "./pages/registration/RegistrationWizard";
import { IceDetectionPage } from "./pages/IceDetectionPage";
import { SolarSystemPage } from "./pages/SolarSystemPage";
import { MissionBriefingPage } from "./pages/MissionBriefingPage";
import { useAppStore } from "./store/appStore";
import { useEffect } from "react";

function Shell() {
  const theme = useAppStore((s) => s.theme);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <ThemeBackground />
      <div className="app-shell">
        <TopBar />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.35 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
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
        <Route path="/solar" element={<SolarSystemPage />} />
        <Route path="/briefing" element={<MissionBriefingPage />} />
      </Route>
    </Routes>
  );
}
