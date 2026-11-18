"use client";

import { ChangeEvent } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  disabled = false,
}: SearchBarProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const clearInput = () => {
    onChange("");
  };

  return (
    <div className="relative w-full max-w-7xl">
      <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
        <Search className="w-4 h-4" />
      </span>

      <input
        type="text"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 outline-none transition bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-2xs focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {value && !disabled && (
        <button
          type="button"
          onClick={clearInput}
          aria-label="Clear search"
          className="absolute inset-y-0 right-2.5 flex items-center justify-center px-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
