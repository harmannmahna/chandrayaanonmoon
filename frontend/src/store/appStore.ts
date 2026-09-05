import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

type AppState = {
  theme: Theme;
  musicOn: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleMusic: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      musicOn: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      toggleMusic: () => set({ musicOn: !get().musicOn }),
    }),
    { name: "lunamatch-ui" },
  ),
);
