"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { ClipboardList, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { SingleChoiceRenderer } from "./SingleChoiceRenderer";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export interface CaseStudyRendererProps extends QuestionRendererProps {
  children?: React.ReactNode;
}

/**
 * Unfolding Case Study & CaseBased* Clinical Scenario wrapper.
 * Renders real backend `question.exhibits` (`questionContents`) and `question.metaStem`
 * in a sticky left/top chart viewer alongside the active question-type renderer.
 * Never fabricates hardcoded clinical notes, vitals, or lab values.
 */
export function CaseStudyRenderer(props: CaseStudyRendererProps) {
  const { question, value, isReview = false, hideRationaleBox = false, children } = props;
  const exhibits = React.useMemo(
    () =>
      (question.exhibits ?? []).filter(
        (ex) => Boolean(ex.content?.trim() || ex.title?.trim())
      ),
    [question.exhibits]
  );

  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [question.id]);

  const activeExhibit = exhibits[activeIndex];
  const hasCaseContext = exhibits.length > 0 || Boolean(question.metaStem?.trim());

  const innerContent = children ?? (
    <SingleChoiceRenderer {...props} hideRationaleBox />
  );

  return (
    <div className="space-y-6">
      <div className={cn("grid grid-cols-1 gap-6", hasCaseContext && "lg:grid-cols-12")}>
        {hasCaseContext && (
          <div className="lg:col-span-5 space-y-3">
            <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
              <div className="bg-surface-muted border-b border-border px-4 py-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-brand-teal" /> Clinical Case Exhibits
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {exhibits.length > 0 ? `${exhibits.length} Exhibit${exhibits.length > 1 ? "s" : ""}` : "Case Context"}
                </Badge>
              </div>

              {exhibits.length > 0 && (
                <div className="flex border-b border-border text-xs font-semibold overflow-x-auto">
                  {exhibits.map((ex, idx) => (
                    <button
                      key={ex.id || idx}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={cn(
                        "px-3 py-2 flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap",
                        activeIndex === idx
                          ? "border-brand-teal text-brand-teal bg-surface"
                          : "border-transparent text-foreground-secondary hover:text-foreground"
                      )}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span>{ex.title || `Exhibit ${idx + 1}`}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="p-4 text-xs leading-relaxed bg-background/50 min-h-[140px] text-foreground-secondary space-y-3">
                {activeExhibit ? (
                  <RichQuestionContent content={activeExhibit.content} />
                ) : question.metaStem ? (
                  <RichQuestionContent content={question.metaStem} />
                ) : null}
              </div>
            </div>
          </div>
        )}

        <div className={cn(hasCaseContext ? "lg:col-span-7" : "w-full", "space-y-4")}>
          {innerContent}
        </div>
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox
          question={question}
          value={value}
          onAskTutor={props.onAskTutor}
          canAskTutor={props.canAskTutor}
        />
      )}
    </div>
  );
}
