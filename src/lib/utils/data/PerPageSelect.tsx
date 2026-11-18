"use client";

interface PerPageSelectProps {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
}

export default function PerPageSelect({
  value,
  onChange,
  options = [5, 10, 20, 50, 100, 200, 500, 700, 1000, 2000, 5000, 10000],
}: PerPageSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Items per page"
      className="px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt} / Page
        </option>
      ))}
    </select>
  );
}
