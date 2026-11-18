"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { CommunityCategoryGroupDto } from "@/lib/api-types";
import {
  Users,
  GraduationCap,
  Award,
  BookOpen,
  Globe2,
  HeartHandshake,
  Briefcase,
  Smile,
  ArrowRight,
  MessageSquare,
  Search,
} from "lucide-react";

const GROUP_ICONS: Record<string, React.ElementType> = {
  "pre-nursing-admissions": GraduationCap,
  "nursing-school-survival": BookOpen,
  "exit-predictor-exams": Award,
  "nclex-rn": GraduationCap,
  "nclex-pn-lpn-lvn": HeartHandshake,
  "international-nurses": Globe2,
  "new-grads-first-year": Users,
  "careers-jobs": Briefcase,
  "wellness-break-room": Smile,
};

export default function CommunityCategoriesPage() {
  const [groups, setGroups] = React.useState<CommunityCategoryGroupDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    let active = true;
    void nurviaApi.getCommunityCategoryGroups().then((res) => {
      if (!active) return;
      if (res.success && res.data) {
        setGroups(res.data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => {
        const matchingCategories = group.categories.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)
        );
        const matchesGroup =
          group.name.toLowerCase().includes(q) ||
          group.description.toLowerCase().includes(q);
        return {
          ...group,
          categories: matchesGroup ? group.categories : matchingCategories,
        };
      })
      .filter((g) => g.categories.length > 0);
  }, [groups, search]);

  return (
    <PublicShell>
      <div className="bg-background text-foreground">
        {/* Header Hero */}
        <section className="border-b border-border bg-gradient-to-b from-surface/80 via-background to-background py-14 sm:py-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-teal/10 text-brand-teal text-xs font-bold uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>NURVIA Nursing Community Taxonomy</span>
            </div>
            <h1 className="font-brand text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground max-w-3xl mx-auto leading-tight">
              Nursing Community Categories
            </h1>
            <p className="text-foreground-secondary text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              Pick your academic stage or examination pathway. Every community forum includes peer discussions, study recommendations, and pinned clinical guides.
            </p>

            <div className="max-w-md mx-auto relative pt-2">
              <Search className="w-4 h-4 absolute left-3.5 top-5 text-foreground-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search categories (e.g. Pharmacology, NGN, TEAS, Night shift)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </div>
          </div>
        </section>

        {/* Categories Stack */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
            {loading ? (
              <div className="py-16 text-center text-sm text-foreground-secondary" aria-live="polite">
                Loading community categories…
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-16 text-center text-sm text-foreground-secondary">
                No categories matched &ldquo;{search}&rdquo;. Try another topic.
              </div>
            ) : (
              filteredGroups.map((group) => {
                const IconComponent = GROUP_ICONS[group.slug] || BookOpen;
                return (
                  <Card key={group.id} className="p-6 sm:p-8 space-y-6 border border-border bg-surface shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-teal/15 text-brand-teal flex items-center justify-center shrink-0">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="font-brand text-xl sm:text-2xl font-bold text-foreground">
                            {group.name}
                          </h2>
                          <p className="text-xs text-foreground-secondary mt-0.5">
                            {group.description}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="w-fit text-[11px]">
                        {group.categories.length} Forums
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.categories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/forum?category=${encodeURIComponent(cat.slug)}`}
                          className="group rounded-xl border border-border/80 bg-background/50 hover:bg-surface-muted/80 p-4 transition-all duration-150 flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-sm text-foreground group-hover:text-brand-teal transition-colors">
                                {cat.name}
                              </h3>
                              {cat.examTrack && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand-teal/10 text-brand-teal">
                                  {cat.examTrack}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-foreground-secondary leading-relaxed line-clamp-2">
                              {cat.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-foreground-muted">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {cat.postCount} discussions
                            </span>
                            <span className="text-brand-teal flex items-center gap-0.5 font-medium group-hover:translate-x-0.5 transition-transform">
                              Explore <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
