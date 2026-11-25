"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

interface StudyLibrarySearchProps {
  value: string;
  onChange: (next: string) => void;
  isSearching?: boolean;
  placeholder?: string;
  className?: string;
}

export function StudyLibrarySearch({
  value,
  onChange,
  isSearching = false,
  placeholder = "Search exams, subjects, or keywords...",
  className = "",
}: StudyLibrarySearchProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted"
        aria-hidden="true"
      />
      <label htmlFor="study-library-search" className="sr-only">
        {placeholder}
      </label>
      <input
        id="study-library-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-14 text-xs sm:text-sm text-foreground shadow-2xs transition-colors placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      />
      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {isSearching && (
          <span className="text-[11px] text-foreground-muted" aria-live="polite">
            Searching...
          </span>
        )}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
