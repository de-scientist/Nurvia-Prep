"use client";

import * as React from "react";
import type { QuestionRendererProps } from "./types";
import { normalizeMediaUrl } from "@/lib/content/html-normalizer";
import { SingleChoiceRenderer } from "./SingleChoiceRenderer";
import { ShortAnswerRenderer } from "./ShortAnswerRenderer";

export const VideoBasedRenderer: React.FC<QuestionRendererProps> = (props) => {
  const { question } = props;
  const mediaItem =
    question.media?.find((m) => /video/i.test(m.type) || m.mimeType?.startsWith("video/")) ??
    question.media?.[0];
  const videoExhibit = question.exhibits?.find((ex) =>
    String(ex.type).toLowerCase().includes("video")
  );
  const src = normalizeMediaUrl(mediaItem?.url || videoExhibit?.content) || mediaItem?.url || "";

  return (
    <div className="space-y-4">
      {src && (
        <div className="rounded-xl border border-border bg-surface-muted/60 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {mediaItem?.description || videoExhibit?.title || "Clinical Video Exhibit"}
          </p>
          <video controls className="max-h-80 w-full rounded-lg bg-black" src={src}>
            Your browser does not support video playback.
          </video>
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
