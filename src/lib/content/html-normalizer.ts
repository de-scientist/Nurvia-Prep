/**
 * NURVIA-PREP — Clinical Examination HTML Normalization & Sanitization Layer
 * 
 * Handles imported Microsoft Word/Office HTML (MsoNormal, MsoListParagraph, <o:p>,
 * Office XML comments, conditional tags, proprietary styling), double-encoded entities,
 * and empty HTML elements. Preserves semantic HTML, tables, lists, clinical highlights,
 * inline media, and EHR exhibits while preventing script injection.
 */

// Basic entity unescaper for double-encoded HTML strings (e.g. &lt;p class=&quot;MsoNormal&quot;&gt;)
export function unescapeHtmlEntities(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/&amp;gt;/g, '>')
    .replace(/&amp;lt;/g, '<')
    .replace(/&amp;quot;/g, '"')
    .replace(/&amp;apos;/g, "'")
    .replace(/&amp;amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Checks whether a string contains HTML markup.
 */
export function containsHtmlTags(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

/**
 * Strips Microsoft Word/Office specific markup, XML comments, and proprietary CSS.
 * Preserves semantic structure, clinical highlights, tables, and emphasis.
 */
export function cleanWordHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let html = input.trim();

  // If the HTML contains double-encoded entities (e.g. &amp;gt; or &lt;p), unescape them
  if (/&amp;(gt|lt|quot|apos|amp);/i.test(html) || (/&lt;[a-z/][\s\S]*&gt;/i.test(html) && !/<[a-z/][\s\S]*>/i.test(html))) {
    html = unescapeHtmlEntities(html);
  }

  // 1. Remove Word XML namespaces, doctypes, and office document fragments
  html = html
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<html[\s\S]*?>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[\s\S]*?>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[\s\S]*?>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<meta[\s\S]*?>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<xml[\s\S]*?>[\s\S]*?<\/xml>/gi, '')
    .replace(/<!--\[if[\s\S]*?\]>[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/gi, '');

  // 2. Remove Microsoft Office specific tags: <o:p>, <w:*>, <m:*>, <v:*>
  html = html
    .replace(/<\/?o:[a-z0-9_-]+[^>]*>/gi, '')
    .replace(/<\/?w:[a-z0-9_-]+[^>]*>/gi, '')
    .replace(/<\/?m:[a-z0-9_-]+[^>]*>/gi, '')
    .replace(/<\/?v:[a-z0-9_-]+[^>]*>/gi, '');

  // 3. Remove Microsoft Word classes (MsoNormal, MsoListParagraph, MsoTableGrid, etc.)
  html = html.replace(/\s*class=(["'])(?:Mso[a-zA-Z0-9_-]+|\s)*\1/gi, '');

  // 4. Sanitize inline styles: strip mso-*, font-family, font-size, line-height, margin overrides
  // But strictly PRESERVE clinical highlights (background-color, mark, color: yellow/gold/etc., text-decoration)
  html = html.replace(/\s*style=(["'])(.*?)\1/gi, (_match, quote, styleContent) => {
    const rules = styleContent.split(';').map((r: string) => r.trim()).filter(Boolean);
    const preservedRules: string[] = [];

    for (const rule of rules) {
      const lower = rule.toLowerCase();
      // Drop Word proprietary styles
      if (lower.startsWith('mso-') || lower.startsWith('tab-stops:')) continue;
      // Drop intrusive fonts and margins that break theme typography
      if (lower.startsWith('font-family:') || lower.startsWith('font-size:')) continue;
      if (lower.startsWith('line-height:') || lower.startsWith('margin:')) continue;
      if (lower.startsWith('margin-top:') || lower.startsWith('margin-bottom:')) continue;
      if (lower.startsWith('margin-left:') || lower.startsWith('margin-right:')) continue;

      // Keep highlights, text formatting, borders, alignment
      if (
        lower.includes('background') ||
        lower.includes('color') ||
        lower.includes('font-weight') ||
        lower.includes('font-style') ||
        lower.includes('text-decoration') ||
        lower.includes('border') ||
        lower.includes('padding') ||
        lower.includes('text-align')
      ) {
        preservedRules.push(rule);
      }
    }

    if (preservedRules.length === 0) return '';
    return ` style=${quote}${preservedRules.join('; ')}${quote}`;
  });

  // 5. Clean up empty/redundant span tags: <span [empty styles]>...</span> -> ...
  html = html.replace(/<span(?:\s+style="")?>([\s\S]*?)<\/span>/gi, '$1');

  // 6. Clean empty paragraphs with only whitespace or &nbsp;
  html = html.replace(/<p[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi, '');

  // 7. Strip forbidden active code (scripts, iframes, objects, forms, on* event attributes)
  html = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
    .replace(/<applet[\s\S]*?>[\s\S]*?<\/applet>/gi, '')
    .replace(/\s*on[a-z]+=(["']).*?\1/gi, '')
    .replace(/\s*on[a-z]+=[^\s>]+/gi, '')
    .replace(/href=(["'])javascript:.*?\1/gi, 'href="#"');

  return html.trim();
}

/**
 * Strips all HTML tags and decodes entities, returning plain text.
 */
export function stripHtmlToPlainText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const cleaned = cleanWordHtml(input);
  return cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Normalizes question stem text.
 * Cleans Word markup, removes empty lines, and ensures formatting is intact.
 */
export function normalizeStemContent(stem: string): string {
  if (!stem || typeof stem !== 'string') return '';
  const cleaned = cleanWordHtml(stem);
  if (!cleaned) return '';
  return cleaned;
}

/**
 * Normalizes an answer option's text.
 * Strips leading redundant prefixes like "A. ", "B) ", "1. " if present so that
 * the option renderer badge (A, B, C...) doesn't duplicate the label.
 * Identifies and flags truly empty/incomplete choices.
 */
export function normalizeOptionContent(rawText: string, optionIndex?: number): {
  normalizedText: string;
  isIncomplete: boolean;
  plainText: string;
} {
  if (!rawText || typeof rawText !== 'string') {
    return {
      normalizedText: '[Incomplete option in source question bank]',
      isIncomplete: true,
      plainText: '',
    };
  }

  const cleanedHtml = cleanWordHtml(rawText);
  const plainText = stripHtmlToPlainText(cleanedHtml);

  // If after cleaning, the plain text is empty or purely whitespace
  if (!plainText || plainText.length === 0) {
    return {
      normalizedText: '[Incomplete option in source question bank]',
      isIncomplete: true,
      plainText: '',
    };
  }

  let normalizedText = cleanedHtml;

  // If optionIndex is provided, prioritize stripping prefix matching that index (e.g. index 1 -> "A. ", "1. ")
  if (typeof optionIndex === 'number' && optionIndex > 0) {
    const letter = String.fromCharCode(64 + Math.min(optionIndex, 26));
    const indexedPrefixRegex = new RegExp(`^(?:${letter}|${optionIndex})[\\.\\)\\:\\-]\\s+`, 'i');
    if (indexedPrefixRegex.test(plainText)) {
      normalizedText = normalizedText.replace(
        new RegExp(`^(<[a-z0-9]+[^>]*>)?(?:${letter}|${optionIndex})[\\.\\)\\:\\-]\\s+`, 'i'),
        '$1'
      );
    }
  }

  // Check if option starts with redundant letter/number prefix matching general pattern
  const prefixRegex = /^(?:[A-Za-z]|[0-9]{1,2})[\.\)\:\-]\s+/;

  if (prefixRegex.test(plainText)) {
    // Safely remove the prefix from the plain text or starting tag
    normalizedText = normalizedText.replace(
      /^(<[a-z0-9]+[^>]*>)?(?:[A-Za-z]|[0-9]{1,2})[\.\)\:\-]\s+/i,
      '$1'
    );
  }

  return {
    normalizedText: normalizedText.trim(),
    isIncomplete: false,
    plainText: plainText.trim(),
  };
}

/**
 * Extracts options array from a raw question record, supporting all known Strata,
 * Qlex, and backend schema variants.
 */
export function extractQuestionOptions(raw: Record<string, unknown>): Array<{
  id: string;
  optionIndex: number;
  optionText: string;
  displayOrder: number;
  isCorrect: boolean;
  specificRationale?: string;
  wasSelected?: boolean;
}> {
  const candidateLists = [
    raw.questionOptions,
    raw.options,
    raw.singleChoiceQuestion,
    raw.multipleSelectQuestion,
    raw.choices,
    raw.answers,
    raw.items,
  ];

  let rawOptions: Array<Record<string, unknown>> = [];
  for (const candidate of candidateLists) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      rawOptions = candidate as Array<Record<string, unknown>>;
      break;
    }
  }

  if (!rawOptions || rawOptions.length === 0) {
    return [];
  }

  return rawOptions.map((opt: Record<string, unknown>, idx: number) => {
    const rawText =
      opt.optionText ??
      opt.answerContent ??
      opt.text ??
      opt.content ??
      opt.option ??
      opt.label ??
      opt.title ??
      opt.value ??
      '';

    const { normalizedText } = normalizeOptionContent(String(rawText), idx + 1);

    const isCorrect = Boolean(
      opt.isCorrect ??
      opt.correct ??
      opt.isAnswer ??
      (opt.state === 'correct') ??
      false
    );

    const specificRationale =
      opt.specificRationale ??
      opt.explanation ??
      opt.rationale ??
      opt.feedback ??
      undefined;

    return {
      id: String(opt.guidId ?? opt.id ?? `opt-${idx + 1}`),
      optionIndex: idx + 1,
      optionText: normalizedText,
      displayOrder: typeof opt.displayOrder === 'number' ? opt.displayOrder : idx + 1,
      isCorrect,
      specificRationale: specificRationale ? String(specificRationale) : undefined,
      wasSelected: Boolean(opt.wasSelected),
    };
  });
}
