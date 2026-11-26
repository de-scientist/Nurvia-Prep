"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { GlobalSearchResultItemDto, GlobalSearchFacetDto } from "@/lib/api-types";
import {
  Search,
  BookOpen,
  FileText,
  Headphones,
  FileSpreadsheet,
  MessageSquare,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  X,
  SlidersHorizontal,
} from "lucide-react";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  study_set: <BookOpen className="h-4 w-4 text-teal-600" />,
  care_plan: <FileText className="h-4 w-4 text-emerald-600" />,
  lecture: <Headphones className="h-4 w-4 text-amber-600" />,
  study_guide: <FileSpreadsheet className="h-4 w-4 text-indigo-600" />,
  community_post: <MessageSquare className="h-4 w-4 text-sky-600" />,
  group: <Users className="h-4 w-4 text-rose-600" />,
  mentor: <Compass className="h-4 w-4 text-purple-600" />,
};

const SUGGESTED_QUERIES = [
  "Pharmacology",
  "Prioritization & Delegation",
  "Fluid and Electrolytes",
  "Cardiovascular",
  "Mark Klimek",
  "Pediatric Milestones",
  "Infection Control",
  "Maternity & Labor",
  "Dosage Calculations",
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQ = searchParams?.get("q") ?? "";
  const initialType = searchParams?.get("type") ?? "all";

  const [query, setQuery] = React.useState(initialQ);
  const [selectedType, setSelectedType] = React.useState(initialType);
  const [results, setResults] = React.useState<GlobalSearchResultItemDto[]>([]);
  const [facets, setFacets] = React.useState<GlobalSearchFacetDto[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const performSearch = React.useCallback(async (qStr: string, tFilter: string) => {
    if (!qStr.trim()) {
      setResults([]);
      setFacets([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    const filter = tFilter === "all" ? undefined : tFilter;
    const res = await nurviaApi.searchGlobal(qStr.trim(), filter);
    if (res.success && res.data) {
      setResults(res.data.items);
      setFacets(res.data.facets);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (initialQ) {
      void performSearch(initialQ, initialType);
    }
  }, [initialQ, initialType, performSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}&type=${selectedType}`);
      void performSearch(query.trim(), selectedType);
    }
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}&type=${type}`);
      void performSearch(query.trim(), type);
    }
  };

  const handleSuggestedClick = (text: string) => {
    setQuery(text);
    router.push(`/search?q=${encodeURIComponent(text)}&type=all`);
    void performSearch(text, "all");
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
            <Link href="/learner" className="hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-700">Search</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Global Nursing Search
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Search across exam sets, care plans, Mark Klimek audio & notes, study guides, community posts, groups, and mentors.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concepts, medications, guidelines, questions, mentors, or study groups..."
              className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-12 pr-28 text-base text-slate-800 shadow-sm transition-all focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className="absolute right-24 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <Button
              type="submit"
              className="absolute right-2 rounded-xl bg-[#0A5C66] px-5 py-2 font-medium text-white hover:bg-[#084c55]"
            >
              Search
            </Button>
          </div>
        </form>

        {/* Facet Filter Tabs */}
        {facets.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
            {facets.map((f) => {
              const active = selectedType === f.type;
              return (
                <button
                  key={f.type}
                  onClick={() => handleTypeSelect(f.type)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-teal-700 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {TYPE_ICONS[f.type]}
                  <span>{f.label}</span>
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                      active ? "bg-teal-800 text-teal-100" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Empty / Suggestions State */}
        {!query.trim() && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <Sparkles className="mx-auto h-10 w-10 text-teal-600" />
            <h3 className="mt-3 text-lg font-bold text-slate-800">Popular Search Topics</h3>
            <p className="mt-1 text-xs text-slate-500">
              Jump directly into the most frequently reviewed clinical areas and licensure prep resources:
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {SUGGESTED_QUERIES.map((item) => (
                <button
                  key={item}
                  onClick={() => handleSuggestedClick(item)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-900 transition-all"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent" />
            <p className="mt-2 text-xs font-medium text-slate-500">Searching Nurvia knowledge base...</p>
          </div>
        )}

        {/* Results List */}
        {!loading && query.trim() && results.length > 0 && (
          <div className="space-y-4">
            <div className="text-xs font-medium text-slate-500">
              Found {totalCount} result{totalCount === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
            </div>

            {results.map((item) => (
              <Card
                key={item.id}
                className="group rounded-2xl border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-teal-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                        {TYPE_ICONS[item.type] || <FileText className="h-3.5 w-3.5 text-slate-500" />}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 capitalize">
                        {item.type.replace("_", " ")}
                      </span>
                      {item.badge && (
                        <Badge className="bg-teal-50 text-teal-800 text-[10px] font-semibold border border-teal-200">
                          {item.badge}
                        </Badge>
                      )}
                      {item.category && (
                        <span className="text-xs text-slate-400">• {item.category}</span>
                      )}
                    </div>

                    <Link href={item.url}>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                        {item.title}
                      </h3>
                    </Link>

                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {item.excerpt}
                    </p>

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    href={item.url}
                    className="flex-shrink-0 rounded-xl bg-slate-50 p-2 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-700 transition-all"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* No Results State */}
        {!loading && query.trim() && results.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <SlidersHorizontal className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-lg font-bold text-slate-800">No matching results found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              We couldn&apos;t find anything matching &ldquo;{query}&rdquo;. Try checking your spelling, switching filter categories, or exploring our suggested topics.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUERIES.slice(0, 5).map((item) => (
                <button
                  key={item}
                  onClick={() => handleSuggestedClick(item)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-500 hover:bg-teal-50 transition-all"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GlobalSearchPage() {
  return (
    <PublicShell>
      <React.Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent" />
          </div>
        }
      >
        <SearchContent />
      </React.Suspense>
    </PublicShell>
  );
}
