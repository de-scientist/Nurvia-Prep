/**
 * NURVIA-PREP — Clinical Case Study & Exhibit Normalization Core (Pure Native ESM)
 *
 * Implements authoritative exhibit deduplication, case study normalization,
 * and question grouping across learner assessment sessions.
 */

export function unescapeBasicHtml(input) {
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

export function cleanExhibitHtml(input) {
  if (!input || typeof input !== 'string') return '';
  let html = input.trim();
  if (/&amp;(gt|lt|quot|apos|amp);/i.test(html) || (/&lt;[a-z/][\s\S]*&gt;/i.test(html) && !/<[a-z/][\s\S]*>/i.test(html))) {
    html = unescapeBasicHtml(html);
  }
  return html
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<html[\s\S]*?>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[\s\S]*?>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[\s\S]*?>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<!--\[if[\s\S]*?\]>[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/gi, '')
    .replace(/<\/?o:[a-z0-9_-]+[^>]*>/gi, '')
    .replace(/<\/?w:[a-z0-9_-]+[^>]*>/gi, '')
    .replace(/<\/?m:[a-z0-9_-]+[^>]*>/gi, '')
    .replace(/<\/?v:[a-z0-9_-]+[^>]*>/gi, '')
    .replace(/\s*class=(["'])(?:Mso[a-zA-Z0-9_-]+|\s)*\1/gi, '')
    .trim();
}

/**
 * Checks whether a questionType corresponds to a Case Study / Case-Based item.
 */
export function isCaseStudyQuestion(type) {
  if (type === undefined || type === null) return false;
  if (type === 9 || type === '9') return true;
  const normalized = String(type).trim().toLowerCase();
  return (
    normalized.startsWith('casebased') ||
    normalized === 'clinicalcasestudy' ||
    normalized === 'unfoldingcasestudy' ||
    normalized === 'casestudy'
  );
}

/**
 * Extracts the authoritative identifier for an exhibit.
 */
export function resolveAuthoritativeExhibitId(ex) {
  if (!ex) return null;
  if (typeof ex.guidId === 'string' && ex.guidId.trim()) {
    return ex.guidId.trim();
  }
  if (typeof ex.id === 'string' && ex.id.trim()) {
    return ex.id.trim();
  }
  if (typeof ex.id === 'number' && Number.isFinite(ex.id)) {
    return String(ex.id);
  }
  if (typeof ex.numericId === 'number' && Number.isFinite(ex.numericId)) {
    return String(ex.numericId);
  }
  return null;
}

/**
 * Computes a sanitized content signature for fallback deduplication
 * when authoritative identifiers are absent.
 */
function computeExhibitContentSignature(ex) {
  const title = String(ex.title || ex.name || '').trim().toLowerCase();
  const rawContent = String(ex.content || ex.description || '').trim();
  const cleaned = cleanExhibitHtml(rawContent).trim().toLowerCase();
  return `${title}:::${cleaned}`;
}

/**
 * Normalizes and deduplicates exhibits belonging to a clinical case.
 *
 * Rules:
 * - Uses authoritative identifiers (`guidId`, `id`, `numericId`) wherever available.
 * - Prevents the same exhibit record from appearing twice within the same case.
 * - Preserves genuinely distinct exhibits, even when their titles or categories are identical.
 * - Never deduplicates solely by display title.
 * - Preserves legitimate repeated clinical notes if they have distinct record identities
 *   or represent distinct source content.
 * - Preserves original exhibit ordering.
 * - Preserves exhibit content, attachments, metadata, and tab-selection behavior.
 */
export function normalizeExhibits(rawExhibits) {
  if (!Array.isArray(rawExhibits) || rawExhibits.length === 0) {
    return [];
  }

  const result = [];
  const seenAuthoritativeIds = new Set();
  const seenSignatures = new Set();

  for (let idx = 0; idx < rawExhibits.length; idx++) {
    const ex = rawExhibits[idx];
    if (!ex) continue;

    const rawTitle = ex.title ?? ex.name;
    const title = cleanExhibitHtml(String(rawTitle || '')).trim() || `Exhibit ${idx + 1}`;

    let rawContent = '';
    if (typeof ex.content === 'string' && ex.content.trim()) {
      rawContent = ex.content;
    } else {
      const parts = [];
      if (typeof ex.description === 'string' && ex.description.trim()) parts.push(ex.description);
      if (typeof ex.instructions === 'string' && ex.instructions.trim()) parts.push(ex.instructions);
      if (typeof ex.prerequisites === 'string' && ex.prerequisites.trim()) parts.push(ex.prerequisites);
      rawContent = parts.join('\n');
    }

    const content = cleanExhibitHtml(rawContent).trim();

    // Skip empty exhibits with neither valid title nor content
    if (!content && title === `Exhibit ${idx + 1}`) {
      continue;
    }

    const authorId = resolveAuthoritativeExhibitId(ex);

    if (authorId) {
      if (seenAuthoritativeIds.has(authorId)) {
        // Genuine duplicate reference to the same exhibit identifier: skip
        continue;
      }
      seenAuthoritativeIds.add(authorId);
    } else {
      // Fallback content-signature comparison when records lack explicit authoritative IDs
      const signature = computeExhibitContentSignature(ex);
      if (seenSignatures.has(signature)) {
        // Exact duplicate content and title reference: skip
        continue;
      }
      seenSignatures.add(signature);
    }

    const effectiveId = authorId || `exh-${idx + 1}`;
    const normalizedType = String(ex.type || 'ClinicalScenario').trim();

    const normalized = {
      id: effectiveId,
      ...(ex.guidId ? { guidId: String(ex.guidId).trim() } : {}),
      ...(typeof ex.numericId === 'number' ? { numericId: ex.numericId } : {}),
      type: normalizedType,
      title,
      content,
      displayOrder: typeof ex.displayOrder === 'number' && ex.displayOrder > 0
        ? ex.displayOrder
        : result.length + 1,
      ...(ex.metadata && typeof ex.metadata === 'object' ? { metadata: ex.metadata } : {}),
      ...(Array.isArray(ex.attachments) ? { attachments: ex.attachments } : {}),
    };

    result.push(normalized);
  }

  return result.map((item, i) => ({
    ...item,
    displayOrder: item.displayOrder ?? i + 1,
  }));
}

/**
 * Extracts the authoritative identifier for a Case Study.
 */
export function resolveAuthoritativeCaseStudyId(item) {
  if (!item) return null;
  if (typeof item.caseStudyGuidId === 'string' && item.caseStudyGuidId.trim()) {
    return item.caseStudyGuidId.trim();
  }
  if (typeof item.caseStudyId === 'string' && item.caseStudyId.trim()) {
    return item.caseStudyId.trim();
  }
  if (typeof item.caseId === 'string' && item.caseId.trim()) {
    return item.caseId.trim();
  }
  if (item.caseStudy && typeof item.caseStudy === 'object') {
    const cs = item.caseStudy;
    const csId = cs.guidId || cs.id || cs.caseStudyId;
    if (typeof csId === 'string' && csId.trim()) return csId.trim();
    if (typeof csId === 'number' && Number.isFinite(csId)) return String(csId);
  }
  // Standalone case study questions or direct case study records
  const isDirectCase = !item.questionType || isCaseStudyQuestion(item.questionType);
  if (isDirectCase) {
    if (typeof item.guidId === 'string' && item.guidId.trim()) return item.guidId.trim();
    if (typeof item.id === 'string' && item.id.trim()) return item.id.trim();
    if (typeof item.id === 'number' && Number.isFinite(item.id)) return String(item.id);
    if (typeof item.numericId === 'number' && Number.isFinite(item.numericId)) return String(item.numericId);
  }
  return null;
}

/**
 * Normalizes a list of Case Study source records or DTOs.
 */
export function normalizeCaseStudies(rawCases) {
  if (!Array.isArray(rawCases) || rawCases.length === 0) {
    return [];
  }

  const casesById = new Map();
  const order = [];

  for (let idx = 0; idx < rawCases.length; idx++) {
    const raw = rawCases[idx];
    if (!raw) continue;

    const caseId = resolveAuthoritativeCaseStudyId(raw) || `case-study-${idx + 1}`;
    const rawTitle = raw.caseTitle || raw.title || (raw.caseStudy && raw.caseStudy.title);
    const title = cleanExhibitHtml(String(rawTitle || '')).trim() || `Clinical Case Study ${casesById.size + 1}`;

    const rawScenario = raw.scenario || raw.metaStem || raw.metaQuestionText || raw.stem || raw.description || '';
    const scenario = cleanExhibitHtml(String(rawScenario)).trim();

    const rawExhibits = Array.isArray(raw.exhibits)
      ? raw.exhibits
      : Array.isArray(raw.questionContents)
        ? raw.questionContents
        : [];

    const normalizedExhibits = normalizeExhibits(rawExhibits);

    const questionId = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id).trim() : null;
    const existingQuestionIds = Array.isArray(raw.questionIds)
      ? raw.questionIds.map(String)
      : [];

    if (casesById.has(caseId)) {
      // Duplicate reference to an existing case study: merge legitimate exhibits and questions
      const existing = casesById.get(caseId);
      const combinedExhibits = normalizeExhibits([...existing.exhibits, ...normalizedExhibits]);
      existing.exhibits = combinedExhibits;

      if (questionId && !existing.questionIds.includes(questionId)) {
        existing.questionIds.push(questionId);
      }
      for (const qid of existingQuestionIds) {
        if (!existing.questionIds.includes(qid)) {
          existing.questionIds.push(qid);
        }
      }
      if (!existing.scenario && scenario) {
        existing.scenario = scenario;
      }
    } else {
      const qIds = [];
      if (questionId) qIds.push(questionId);
      for (const qid of existingQuestionIds) {
        if (!qIds.includes(qid)) qIds.push(qid);
      }

      const normalizedCase = {
        id: caseId,
        ...(raw.guidId ? { guidId: String(raw.guidId).trim() } : {}),
        ...(typeof raw.numericId === 'number' ? { numericId: raw.numericId } : {}),
        title,
        scenario,
        ...(raw.metaStem ? { metaStem: cleanExhibitHtml(String(raw.metaStem)).trim() } : {}),
        ...(raw.description ? { description: cleanExhibitHtml(String(raw.description)).trim() } : {}),
        ...(raw.instructions ? { instructions: cleanExhibitHtml(String(raw.instructions)).trim() } : {}),
        exhibits: normalizedExhibits,
        questionIds: qIds,
      };

      casesById.set(caseId, normalizedCase);
      order.push(caseId);
    }
  }

  return order.map((id) => casesById.get(id));
}

/**
 * Groups an examination question list into case-study groups.
 */
export function groupQuestionsByCaseStudy(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const groups = [];
  const caseMap = new Map();

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const caseId = resolveAuthoritativeCaseStudyId(q);
    const isCase = isCaseStudyQuestion(q.questionType) || Boolean(caseId);

    if (isCase && caseId) {
      if (caseMap.has(caseId)) {
        const group = caseMap.get(caseId);
        group.questions.push(q);
        if (Array.isArray(q.exhibits) && group.caseStudy) {
          group.caseStudy.exhibits = normalizeExhibits([
            ...group.caseStudy.exhibits,
            ...q.exhibits,
          ]);
        }
      } else {
        const rawTitle = q.caseTitle || (q.caseStudy && q.caseStudy.title) || q.metaStem;
        const title = cleanExhibitHtml(String(rawTitle || '')).trim() || `Clinical Case Study`;
        const scenario = cleanExhibitHtml(String(q.metaStem || q.scenario || q.stem || '')).trim();
        const rawExhibits = Array.isArray(q.exhibits) ? q.exhibits : [];

        const caseStudy = {
          id: caseId,
          title,
          scenario,
          exhibits: normalizeExhibits(rawExhibits),
          questionIds: [String(q.id || `q-${idx + 1}`)],
        };

        const newGroup = {
          caseStudyId: caseId,
          isCaseStudy: true,
          caseStudy,
          questions: [q],
        };
        caseMap.set(caseId, newGroup);
        groups.push(newGroup);
      }
    } else {
      groups.push({
        caseStudyId: null,
        isCaseStudy: false,
        caseStudy: null,
        questions: [q],
      });
    }
  }

  return groups;
}

/**
 * Resolves case-study navigation metrics across an examination's questions.
 */
export function getCaseStudyNavigation(questions, currentQuestionIndex) {
  const safeIndex = Math.max(0, Math.min(questions.length - 1, currentQuestionIndex));
  const currentQ = questions[safeIndex];

  if (!currentQ) {
    return {
      isCaseStudy: false,
      caseStudyId: null,
      totalCasesInExam: 0,
      currentCaseIndex: -1,
      questionIndexInCase: -1,
      totalQuestionsInCase: 0,
      isFirstInCase: false,
      isLastInCase: false,
      prevCaseQuestionIndex: null,
      nextCaseQuestionIndex: null,
    };
  }

  const caseId = resolveAuthoritativeCaseStudyId(currentQ);
  const isCase = isCaseStudyQuestion(currentQ.questionType) || Boolean(caseId);

  const groups = groupQuestionsByCaseStudy(questions);
  const caseGroups = groups.filter((g) => g.isCaseStudy);
  const currentGroupIndex = groups.findIndex((g) => g.questions.includes(currentQ));
  const currentGroup = groups[currentGroupIndex];

  if (!isCase || !currentGroup || !currentGroup.isCaseStudy) {
    return {
      isCaseStudy: false,
      caseStudyId: null,
      totalCasesInExam: caseGroups.length,
      currentCaseIndex: -1,
      questionIndexInCase: -1,
      totalQuestionsInCase: 0,
      isFirstInCase: false,
      isLastInCase: false,
      prevCaseQuestionIndex: null,
      nextCaseQuestionIndex: null,
    };
  }

  const caseIndex = caseGroups.findIndex((g) => g.caseStudyId === currentGroup.caseStudyId);
  const questionsInThisCase = currentGroup.questions;
  const questionIndexInCase = questionsInThisCase.indexOf(currentQ);
  const totalQuestionsInCase = questionsInThisCase.length;

  let prevCaseQuestionIndex = null;
  let nextCaseQuestionIndex = null;

  if (caseIndex > 0) {
    const prevGroup = caseGroups[caseIndex - 1];
    prevCaseQuestionIndex = questions.indexOf(prevGroup.questions[0]);
  }

  if (caseIndex >= 0 && caseIndex < caseGroups.length - 1) {
    const nextGroup = caseGroups[caseIndex + 1];
    nextCaseQuestionIndex = questions.indexOf(nextGroup.questions[0]);
  }

  return {
    isCaseStudy: true,
    caseStudyId: currentGroup.caseStudyId,
    caseStudyTitle: currentGroup.caseStudy?.title,
    totalCasesInExam: caseGroups.length,
    currentCaseIndex: caseIndex,
    questionIndexInCase,
    totalQuestionsInCase,
    isFirstInCase: questionIndexInCase === 0,
    isLastInCase: questionIndexInCase === totalQuestionsInCase - 1,
    prevCaseQuestionIndex,
    nextCaseQuestionIndex,
  };
}

/**
 * Deduplicates questions by authoritative identifier while preserving question order.
 */
export function deduplicateQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  const seen = new Set();
  const result = [];

  for (const q of questions) {
    const key = String(q.guidId || q.id || '').trim();
    if (!key) {
      result.push(q);
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(q);
  }

  return result;
}
