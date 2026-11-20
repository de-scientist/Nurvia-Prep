"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button";

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = React.useState<boolean>(false);
  const [mounted, setMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem("nurvia_theme") || localStorage.getItem("theme");
    // Authoritative default is light mode; system dark preference does NOT override default
    const activeDark = storedTheme === "dark" || (typeof storedTheme === "string" && storedTheme.includes('"global":"dark"'));

    setIsDark(activeDark);
    if (activeDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      localStorage.setItem("nurvia_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("nurvia_theme", "light");
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className}
        aria-label="Toggle theme placeholder"
      >
        <span className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light Mode" : "Dark Mode"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="h-5 w-5 text-slate-600 transition-transform hover:-rotate-12 dark:text-slate-300" />
      )}
    </Button>
  );
}
