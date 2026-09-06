import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

type AppState = {
  theme: Theme;
  musicOn: boolean;
  lastRegistrationJobId: string | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleMusic: () => void;
  setLastRegistrationJobId: (jobId: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      musicOn: false,
      lastRegistrationJobId: null,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      toggleMusic: () => set({ musicOn: !get().musicOn }),
      setLastRegistrationJobId: (jobId) => set({ lastRegistrationJobId: jobId }),
    }),
    { name: "lunamatch-ui" },
  ),
);
