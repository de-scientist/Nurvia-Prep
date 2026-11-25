"use client";

import { Sun, Moon, ChevronDown, Palette, X, Check } from "lucide-react";
import {
  useThemeContext,
  CustomColors,
  DEFAULT_THEME_COLORS,
} from "@/lib/contexts/panel/layout/theme/PanelThemeContext";

import React, { useState, useRef, useEffect } from "react";
import { HexColorPicker } from "react-colorful";


const ThemeDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColorTarget, setCurrentColorTarget] = useState<keyof CustomColors>("navbar");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    theme,
    customColors,
    setTheme,
    setCustomColors,
    resetCustomColors,
  } = useThemeContext();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleThemeChange = (newTheme: "default" | "light" | "dark" | "custom") => {
    const components = ["navbar", "leftSidebar", "rightSidebar", "content", "footer"] as const;

    if (newTheme === "custom") {
      components.forEach((c) => setTheme(c, "custom"));
      setTheme("global", "custom");
      setShowColorPicker(true);
    }

    else if (newTheme === "default") {
      components.forEach((c) => setTheme(c, "default"));
      setTheme("global", "default");
    }

    else {
      // light | dark
      components.forEach((c) => setTheme(c, newTheme));
      setTheme("global", newTheme);
      // DO NOT touch customColors
    }

    setIsOpen(false);
  };


  const handleColorChange = (color: string) => {
    setCustomColors({ [currentColorTarget]: color });
    if (currentColorTarget !== "text") {
      setTheme(currentColorTarget as Exclude<keyof CustomColors, "text">, "custom");
    }
  };

  const handleResetCustomColors = () => {
    const components = ["navbar", "leftSidebar", "rightSidebar", "content", "footer"] as const;

    resetCustomColors();

    components.forEach((c) => setTheme(c, "default"));
    setTheme("global", "default");

    setShowColorPicker(false);
    setIsOpen(false);
  };

  const getActiveThemeMode = () => {
    if (theme.global === "custom") return "custom";
    if (theme.global === "default") return "default";
    if (theme.global === "dark") return "dark";
    if (theme.global === "light") return "light";
    return theme.global;
  };

  const activeMode = getActiveThemeMode();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 text-slate-700 dark:text-[var(--text-color)] border border-slate-200 dark:border-slate-700 hover:border-[#0D9488] hover:text-[#0D9488] rounded-xl transition"
      >
        {activeMode === "dark" ? (
          <Moon className="w-4.5 h-4.5" />
        ) : activeMode === "light" ? (
          <Sun className="w-4.5 h-4.5" />
        ) : activeMode === "default" ? (
          <Palette className="w-4.5 h-4.5 text-[#0D9488]" />
        ) : (
          <Palette className="w-4.5 h-4.5" />
        )}
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#111C2E] rounded-xl shadow-xl py-1.5 z-50 border border-slate-200 dark:border-slate-800 select-none">
          {["default", "light", "dark", "custom"].map((mode) => (
            <button
              key={mode}
              onClick={() => handleThemeChange(mode as "default" | "light" | "dark" | "custom")}
              className={`flex items-center px-4 py-2 text-sm font-medium w-full text-left transition-colors ${mode === activeMode
                ? "bg-[#0D9488]/10 text-[#0D9488] font-semibold"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              {mode === "light" && <Sun className="w-4 h-4 mr-2.5" />}
              {mode === "dark" && <Moon className="w-4 h-4 mr-2.5" />}
              {mode === "custom" && <Palette className="w-4 h-4 mr-2.5" />}
              {mode === "default" && <Palette className="w-4 h-4 mr-2.5 text-[#0D9488]" />}
              {mode[0].toUpperCase() + mode.slice(1)}
              {mode === activeMode && <Check className="w-4 h-4 ml-auto text-[#0D9488]" />}
            </button>
          ))}
        </div>
      )}

      {showColorPicker && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/50 backdrop-blur-xs select-none p-4">
          <div
            className="
            relative
            bg-white dark:bg-[#111C2E]
            p-5
            rounded-2xl
            shadow-2xl
            w-[320px]
            border border-slate-200 dark:border-slate-800
            text-slate-900 dark:text-slate-100
          "
          >

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold tracking-tight">
                Custom Theme Palette
              </h2>

              <button
                onClick={() => setShowColorPicker(false)}
                className="
                  p-1.5
                  rounded-lg
                  border border-slate-200 dark:border-slate-700
                  text-slate-500 hover:text-slate-900 dark:hover:text-white
                  hover:bg-slate-100 dark:hover:bg-slate-800
                  transition
                "
                aria-label="Close color picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-3 text-left">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Select Target Surface
              </label>
              <select
                value={currentColorTarget}
                onChange={(e) => setCurrentColorTarget(e.target.value as keyof CustomColors)}
                className="
                  w-full
                  px-3 py-2
                  text-xs font-medium
                  border border-slate-200 dark:border-slate-700
                  rounded-xl
                  bg-slate-50 dark:bg-slate-900
                  text-slate-900 dark:text-slate-100
                  focus:outline-none focus:ring-2 focus:ring-[#0D9488]
                "
              >
                <option value="navbar">Navigation Bar</option>
                <option value="leftSidebar">Left Sidebar</option>
                <option value="rightSidebar">Right Sidebar</option>
                <option value="content">Body Content</option>
                <option value="footer">Footer Section</option>
                <option value="text">Text Color</option>
              </select>
            </div>

            <div className="mb-3 flex justify-center">
              <HexColorPicker
                color={(customColors ?? DEFAULT_THEME_COLORS)[currentColorTarget]}
                onChange={handleColorChange}
                className="w-full h-40 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                style={{ backgroundColor: (customColors ?? DEFAULT_THEME_COLORS)[currentColorTarget] }}
              />
              <input
                type="text"
                value={(customColors ?? DEFAULT_THEME_COLORS)[currentColorTarget]}
                onChange={(e) => handleColorChange(e.target.value)}
                className="
                  flex-1
                  px-3 py-1.5
                  text-xs font-mono
                  border border-slate-200 dark:border-slate-700
                  rounded-xl
                  bg-slate-50 dark:bg-slate-900
                  text-slate-900 dark:text-slate-100
                  focus:outline-none focus:ring-2 focus:ring-[#0D9488]
                "
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowColorPicker(false)}
                className="
                  w-full
                  py-2
                  text-xs
                  font-semibold
                  rounded-xl
                  bg-[#142B4A] hover:bg-[#0D9488]
                  text-white
                  shadow-xs
                  transition-colors
                "
              >
                Apply &amp; Close
              </button>

              <button
                onClick={handleResetCustomColors}
                className="
                  w-full
                  py-2
                  text-xs
                  font-semibold
                  rounded-xl
                  border border-slate-200 dark:border-slate-700
                  bg-slate-50 dark:bg-slate-800/60
                  text-slate-700 dark:text-slate-300
                  hover:bg-slate-100 dark:hover:bg-slate-800
                  transition-colors
                "
              >
                Reset to QuizNurse Default
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default ThemeDropdown;
