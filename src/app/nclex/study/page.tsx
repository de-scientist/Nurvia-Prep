"use client";

import * as React from "react";
import { GraduationCap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NclexStudyRedirectPage() {
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace("https://www.prepford.com/");
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 text-center space-y-5 shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="font-brand text-2xl font-bold text-foreground">
            Redirecting to PrepFord
          </h1>
          <p className="text-sm text-foreground-secondary leading-relaxed">
            All dedicated NCLEX-RN and NCLEX-PN preparation is hosted exclusively on PrepFord.
          </p>
        </div>
        <div>
          <a href="https://www.prepford.com/" rel="noopener noreferrer">
            <Button className="w-full flex items-center justify-center gap-2">
              <span>Go to PrepFord NCLEX</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
        <p className="text-xs text-foreground-muted">
          QuizNurse focuses exclusively on RN, LPN, RN Exit, and LPN Exit academic courses and examinations.
        </p>
      </div>
    </div>
  );
}
