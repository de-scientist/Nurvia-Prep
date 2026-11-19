"use client";

import * as React from "react";
import type { QuestionRendererProps } from "./types";
import { normalizeMediaUrl } from "@/lib/content/html-normalizer";
import { SingleChoiceRenderer } from "./SingleChoiceRenderer";
import { ShortAnswerRenderer } from "./ShortAnswerRenderer";

export const AudioBasedRenderer: React.FC<QuestionRendererProps> = (props) => {
  const { question } = props;
  const mediaItem =
    question.media?.find((m) => /audio/i.test(m.type) || m.mimeType?.startsWith("audio/")) ??
    question.media?.[0];
  const audioExhibit = question.exhibits?.find((ex) =>
    String(ex.type).toLowerCase().includes("audio")
  );
  const src = normalizeMediaUrl(mediaItem?.url || audioExhibit?.content) || mediaItem?.url || "";

  return (
    <div className="space-y-4">
      {src && (
        <div className="rounded-xl border border-border bg-surface-muted/60 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {mediaItem?.description || audioExhibit?.title || "Clinical Audio Exhibit"}
          </p>
          <audio controls className="w-full" src={src}>
            Your browser does not support audio playback.
          </audio>
        </div>
      )}
      {question.options.length > 0 ? (
        <SingleChoiceRenderer {...props} />
      ) : (
        <ShortAnswerRenderer {...props} />
      )}
    </div>
  );
};
