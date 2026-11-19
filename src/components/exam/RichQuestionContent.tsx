"use client";

import * as React from "react";
import parse, { DOMNode, Element, domToReact } from "html-react-parser";
import {
  cleanWordHtml,
  containsHtmlTags,
  normalizeMediaUrl,
  stripHtmlToPlainText,
} from "@/lib/content/html-normalizer";
import { cn } from "@/lib/utils";

interface RichQuestionContentProps {
  content?: string | null;
  className?: string;
  fallback?: string;
  as?: React.ElementType;
}

/**
 * Renders normalized rich HTML examination content (stems, options, rationales,
 * exhibits) securely without raw `<p class="MsoNormal">` text or script injection.
 */
export function RichQuestionContent({
  content,
  className,
  fallback = "—",
  as: Component = "div",
}: RichQuestionContentProps) {
  const rendered = React.useMemo(() => {
    if (!content || typeof content !== "string") {
      return fallback;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return fallback;
    }

    // Check if the content is plain text with no HTML markup
    if (!containsHtmlTags(trimmed)) {
      return trimmed;
    }

    // Clean Microsoft Word cruft and sanitize
    const cleaned = cleanWordHtml(trimmed);
    if (!cleaned) {
      return fallback;
    }

    // If after cleaning it's just plain text with no tags
    if (!containsHtmlTags(cleaned)) {
      return stripHtmlToPlainText(cleaned);
    }

    // Parse HTML safely with html-react-parser
    try {
      return parse(cleaned, {
        replace: (domNode: DOMNode) => {
          if (domNode instanceof Element) {
            // Ensure images have responsive clinical styling and normalized media URLs
            if (domNode.name === "img") {
              const attribs = domNode.attribs || {};
              const rawSrc = attribs.src || "";
              // Reject unsafe javascript or data-svg with scripts
              if (rawSrc.toLowerCase().startsWith("javascript:")) {
                return <span className="text-xs text-rose-500">[Unsafe media blocked]</span>;
              }
              const src = normalizeMediaUrl(rawSrc) || rawSrc;
              return (
                <img
                  src={src}
                  alt={attribs.alt || "Clinical exam exhibit image"}
                  className="my-3 max-h-96 w-auto max-w-full rounded-lg border border-border object-contain shadow-xs"
                  loading="lazy"
                />
              );
            }

            // Tables in clinical stems
            if (domNode.name === "table") {
              return (
                <div className="my-3 overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    {domToReact(domNode.children as DOMNode[])}
                  </table>
                </div>
              );
            }

            // Table headers
            if (domNode.name === "th") {
              return (
                <th className="border-b border-border bg-surface-muted px-3 py-2 font-bold text-foreground">
                  {domToReact(domNode.children as DOMNode[])}
                </th>
              );
            }

            // Table cells
            if (domNode.name === "td") {
              return (
                <td className="border-b border-border/60 px-3 py-2 text-foreground-secondary">
                  {domToReact(domNode.children as DOMNode[])}
                </td>
              );
            }

            // Paragraphs: unwrap <p> when rendering inline (as="span") to avoid invalid button/span nesting
            if (domNode.name === "p") {
              if (Component === "span") {
                return <span className="inline">{domToReact(domNode.children as DOMNode[])}</span>;
              }
              return (
                <p className="mb-2 last:mb-0 leading-relaxed">
                  {domToReact(domNode.children as DOMNode[])}
                </p>
              );
            }

            // Clinical highlights (<mark> or styled spans)
            if (domNode.name === "mark") {
              return (
                <mark className="rounded bg-amber-100 px-1 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  {domToReact(domNode.children as DOMNode[])}
                </mark>
              );
            }
          }
          return undefined;
        },
      });
    } catch {
      // In the rare event of HTML parser failure, fallback to safe plain text
      return stripHtmlToPlainText(cleaned);
    }
  }, [content, fallback]);

  return (
    <Component className={cn("leading-relaxed", className)}>
      {rendered}
    </Component>
  );
}
