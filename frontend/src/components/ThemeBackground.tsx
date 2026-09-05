import { useAppStore } from "../store/appStore";

export function ThemeBackground() {
  const theme = useAppStore((s) => s.theme);
  return <div aria-hidden className={theme === "dark" ? "starfield" : "skyfield"} />;
}
