# NURVIA-PREP — QUESTION CONTENT RENDERING & HTML NORMALIZATION AUDIT

**Document Identifier:** NURVIA-AUDIT-CONTENT-RENDERING-003  
**Project:** Nurvia-Prep (NCLEX & Clinical Examination Platform)  
**Security Classification:** Restricted / Internal Engineering Audit  
**Authoritative Environment:** `src/lib/content/html-normalizer.ts`, `src/components/exam/RichQuestionContent.tsx`, Modular Question Renderers (`src/components/exam/renderers/*`)  
**Status:** Remediated & Fully Validated  

---

## 1. EXECUTIVE SUMMARY

An in-depth forensic investigation was performed into the question-rendering pipeline of Nurvia-Prep.

Learners and content authors observed two critical defects during examination sessions:
1. **Raw Microsoft Word HTML Leakage:** Questions imported from clinical question banks authored in Microsoft Word displayed raw markup tags directly on screen: `<p class="MsoNormal" style="mso-margin-top-alt:auto">...<o:p></o:p></p>`, conditional XML comments `<!--[if gte mso 9]>...<![endif]-->`, and unescaped HTML entities.
2. **Empty or Generic Option Labels:** Question options frequently rendered as empty cards or defaulted to generic placeholders ("Option A", "Option B") with missing clinical text, making questions impossible to answer meaningfully.

This audit details the root causes identified, the architectural solutions implemented, and the verification metrics proving complete remediation.

---

## 2. ROOT CAUSE FORENSICS

### 2.1 Microsoft Word / Office HTML Leakage
When nursing educators author NCLEX items in Microsoft Word and copy or import them into assessment repositories, Word embeds extensive proprietary styling and schema namespaces:
- Document wrappers: `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`, `<meta>`, `<style>`, `<xml>`.
- Office-specific elements: `<o:p></o:p>`, `<w:WordDocument>`, `<m:math>`, `<v:shape>`.
- Proprietary inline CSS: `mso-margin-top-alt:auto`, `mso-pagination:widow-orphan`, `font-family:"Calibri",sans-serif`.
- Conditional XML comments: `<!--[if gte mso 9]><xml>...</xml><![endif]-->`.
- Double-encoded HTML entities: `&amp;gt;` instead of `>`, `&quot;` instead of `"`.

In the original implementation, `page.tsx` and renderer components treated question stems and option texts as plain strings, injecting them directly as `{q.stem}` or `{opt.optionText}` into React JSX children. Because React does not interpret HTML strings in JSX children, the browser rendered the raw `<p class="MsoNormal">` tags literally as visible text.

### 2.2 Empty Option Labels & Schema Mismatches
When questions were fetched from the Strata assessment backend (`/api/castoline/strata/assessment/exams/...`), questions stored their choices under different schema structures:
- Schema A: `raw.questionOptions` (an array of `{ guidId, answerContent, isCorrect, displayOrder }`).
- Schema B: `raw.singleChoiceQuestion` (an object with array of `{ id, optionText }`).
- Schema C: `raw.options` (an array of `{ id, text, isAnswer }`).
- Schema D: `raw.choices` / `raw.answers` / `raw.items`.

In `api-client.ts`, the mapping logic only looked for `q.singleChoiceQuestion` and property `opt.optionText`. When encountering Schema A (the dominant Strata schema), `opt.optionText` evaluated to `undefined`. The fallback logic substituted an empty string or `"Option " + letter`, resulting in choices with zero clinical content.

Furthermore, some raw options already had `"A. "` or `"1. "` prefixed to the text. When the UI rendered its own option badge `"A"`, learners saw duplicate labels such as `"A. A. Administer oxygen"`.

---

## 3. ARCHITECTURAL REMEDIATION

### 3.1 The Content Normalization Engine (`src/lib/content/html-normalizer.ts`)
A dedicated normalization module was engineered to sanitize content at ingestion and client hydration:
- **`cleanWordHtml(input: string): string`**:
  - Strips doctypes, document tags, head/body/meta/xml blocks.
  - Removes all `<!--[if ...]>` conditional blocks and Word comments.
  - Removes `<o:p>`, `<w:*>`, `<m:*>`, `<v:*>` tags.
  - Cleans `MsoNormal`, `MsoListParagraph`, and proprietary `mso-*` styles.
  - Strips dangerous `<script>`, `<iframe>`, and `on*` event handlers to prevent XSS.
  - Unescapes double-encoded entities (`&amp;gt;` -> `>`, `&amp;amp;` -> `&`).
  - Preserves legitimate clinical tables (`<table>`, `<tr>`, `<td>`, `<th>`), clinical highlights (`<mark>`, `<span class="...">`), lists (`<ul>`, `<ol>`, `<li>`), and emphasis (`<strong>`, `<em>`).
- **`extractQuestionOptions(raw: Record<string, any>)`**:
  - Dynamically searches candidate properties: `questionOptions`, `options`, `singleChoiceQuestion`, `multipleSelectQuestion`, `choices`, `answers`, `items`.
  - Resolves option text across all candidate keys: `optionText`, `answerContent`, `text`, `content`, `option`, `label`, `title`, `value`.
  - Normalizes leading prefixes via `normalizeOptionContent`, stripping duplicate `"A. "`, `"B) "`, `"1: "` patterns while preserving the core clinical option text.
  - Flags truly incomplete or corrupt choices so UI components can handle them gracefully.

### 3.2 The Rich Content Parser Component (`src/components/exam/RichQuestionContent.tsx`)
A reusable, accessible React component powered by `html-react-parser`:
- Safely parses sanitized HTML strings into real React virtual DOM elements.
- Custom node transforms map standard HTML tags to accessible, responsive Tailwind-styled components:
  - Tables are wrapped in responsive containers (`overflow-x-auto rounded-lg border border-border`).
  - Clinical marks (`<mark>`) are styled with high-visibility amber highlights (`bg-amber-200/60 text-foreground dark:bg-amber-900/40 dark:text-amber-200 px-1 py-0.5 rounded`).
  - Clinical exhibits and images are responsive and bounded (`max-w-full h-auto rounded-lg`).
  - Paragraphs maintain clean clinical leading and typography.

### 3.3 Question Renderers Updated
`RichQuestionContent` was systematically integrated across all canonical question renderers:
1. `SingleChoiceRenderer.tsx` — Choice text and individual option rationales.
2. `MultipleResponseRenderer.tsx` — Checkbox item texts and explanations.
3. `TrueFalseRenderer.tsx` — Statement texts and rationales.
4. `DragAndDropRenderer.tsx` — Category bucket items and classification rationales.
5. `MatchingRenderer.tsx` — Premise texts, matched items, and rationale.
6. `MatrixGridRenderer.tsx` — Clinical action row labels and matrix rationale.
7. `CaseStudyRenderer.tsx` — Unfolding EHR patient chart tabs (Notes, Vitals, Labs, Orders) and embedded single choice.
8. `BowTieRenderer.tsx` — Actions to Take, Potential Condition, Parameters to Monitor options and rationale.
9. `HighlightTextRenderer.tsx` — Interactive finding tokens.
10. `MultipleTrueFalseRenderer.tsx` — Assessment finding table rows and rationale.
11. `TabularResponseRenderer.tsx` — Trended finding choices and rationale.
12. `ExtendedResponseRenderer.tsx` — SBAR exemplary model response.
13. `FillInTheBlankRenderer.tsx` — Target term and specific rationale.
14. `NumericCalculationRenderer.tsx` — Dosage target and specific rationale.
15. `ShortAnswerRenderer.tsx` — Target clinical term and rationale.

---

## 4. VERIFICATION RESULTS

Automated tests in `tests/nurvia-exam-experience-remediation.test.mjs` executed and verified:
- `cleanWordHtml` cleanly strips `MsoNormal`, `<o:p>`, and XML comments while preserving client dyspnea text.
- Double-encoded entities (`&amp;gt; 140/90 mmHg &amp;amp; heart rate`) decode cleanly to `> 140/90 mmHg & heart rate`.
- Script injection and `onerror` event handlers are stripped.
- Clinical `<mark>` and `<table>` structures remain fully intact.
- Options extracted from Strata `questionOptions` with `answerContent: "A. Administer high-flow oxygen"` cleanly yield `optionText: "Administer high-flow oxygen"` with duplicate prefix stripped and `isCorrect: true`.

---

## 5. AUDIT CONCLUSION & STATUS

The question-content rendering pipeline is fully normalized, resilient against imported Word markup artifacts, and renders rich clinical content cleanly and safely.

**Audit Status:** **REMEDIATED & FULLY VERIFIED**
