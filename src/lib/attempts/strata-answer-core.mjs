/**
 * NURVIA-PREP — Canonical 38-Type Question Adapter Core (Pure Native ESM)
 *
 * Bridges NURVIA's interactive frontend renderers with the authoritative LexmaCasto/Strata
 * assessment backend across all 19 standalone + 19 CaseBased question types (plus NURVIA aliases).
 * Kept in extensionless-free `.mjs` so both Next.js bundlers and Node native ESM test runners
 * can execute it without import-extension errors.
 */

const NUMERIC_TYPE_MAP = {
  1: 'SingleChoice',
  2: 'MultipleSelect',
  3: 'TrueFalse',
  4: 'BlankFill',
  5: 'NumericResponse',
  6: 'OrderingItem',
  7: 'Matching',
  8: 'MatrixSingleChoice',
  9: 'CaseBasedSingleChoice',
  10: 'BowTie',
  11: 'MultipleTrueFalse',
  12: 'DynamicImage',
  13: 'MultipleImage',
  14: 'DragAndDrop',
  15: 'ExtendedResponse',
  16: 'TabularResponse',
  17: 'OpenEnded',
  18: 'SingleChoice',
  19: 'AudioBased',
  20: 'VideoBased',
};

const BASE_TO_ACTION_SUFFIX = {
  singlechoice: 'SingleChoice',
  multiplechoice: 'SingleChoice',
  tabularresponse: 'SingleChoice',
  multipleselect: 'MultipleSelect',
  multipleresponse: 'MultipleSelect',
  selectallthatapply: 'MultipleSelect',
  sata: 'MultipleSelect',
  truefalse: 'TrueFalse',
  numericresponse: 'NumericResponse',
  numericcalculation: 'NumericResponse',
  matching: 'Matching',
  orderingnumber: 'OrderingNumber',
  orderingitem: 'OrderingItem',
  orderedresponse: 'OrderingItem',
  orderingdragdrop: 'OrderingDragDrop',
  draganddrop: 'OrderingDragDrop',
  dynamicimage: 'DynamicImage',
  imagebased: 'DynamicImage',
  multipleimage: 'MultipleImage',
  multipleimageselection: 'MultipleImage',
  blankselect: 'BlankSelect',
  blankfill: 'BlankFill',
  fillintheblank: 'BlankFill',
  cloze: 'BlankFill',
  hotspot: 'Hotspot',
  openended: 'OpenEnded',
  shortanswer: 'OpenEnded',
  extendedresponse: 'OpenEnded',
  highlight: 'HighLight',
  audiobased: 'AudioBased',
  videobased: 'VideoBased',
  matrixsinglechoice: 'MatrixSingleChoice',
  matrixgrid: 'MatrixSingleChoice',
  matrixmultipleselect: 'MatrixMultipleSelect',
};

export function resolveNormalizedQuestionType(questionType) {
  let rawStr = '';
  if (typeof questionType === 'number') {
    rawStr = NUMERIC_TYPE_MAP[questionType] || 'SingleChoice';
  } else {
    rawStr = String(questionType || 'SingleChoice').trim();
  }
  const lower = rawStr.toLowerCase();
  const isCaseBased = lower.startsWith('casebased');
  const baseType = isCaseBased ? lower.slice('casebased'.length) || 'singlechoice' : lower;
  return { raw: rawStr, isCaseBased, baseType };
}

export function getStrataSubmissionType(questionType) {
  const { isCaseBased, baseType } = resolveNormalizedQuestionType(questionType);
  const suffix = BASE_TO_ACTION_SUFFIX[baseType] || 'SingleChoice';
  return `${isCaseBased ? 'ActionCaseBased' : 'Action'}${suffix}`;
}

function tryParseJson(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed.replace(/^"(.*)"$/, '$1');
}

function toNumericId(rawId) {
  if (rawId === undefined || rawId === null) return null;
  if (typeof rawId === 'number' && Number.isFinite(rawId)) return rawId;
  const s = String(rawId).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

function resolveOptionNumericId(q, optId) {
  const found = (q.options || []).find((o) => o.id === optId || String(o.numericId) === optId);
  if (found && found.numericId !== undefined) return found.numericId;
  return toNumericId(optId) ?? optId;
}

export function toStrataAnswerPayload(q, responseJson) {
  if (!responseJson || ['null', '""', '[]', '{}', ''].includes(String(responseJson).trim())) {
    return null;
  }

  const parsed = tryParseJson(responseJson);
  const { baseType } = resolveNormalizedQuestionType(q.questionType);

  if (parsed === null || parsed === '') return null;

  // SingleChoice
  if (baseType === 'singlechoice' || baseType === 'multiplechoice' || baseType === 'tabularresponse') {
    const selectedId =
      typeof parsed === 'object' && parsed !== null
        ? String(parsed.SelectedOptionId ?? parsed.selectedOptionId ?? '')
        : String(parsed);
    if (!selectedId) return null;
    return resolveOptionNumericId(q, selectedId);
  }

  // TrueFalse -> boolean
  if (baseType === 'truefalse') {
    const rawVal =
      typeof parsed === 'object' && parsed !== null
        ? String(parsed.value ?? parsed.SelectedOptionId ?? '')
        : String(parsed);
    const matchedOpt = (q.options || []).find((o) => o.id === rawVal || String(o.numericId) === rawVal);
    const candidate = (matchedOpt ? matchedOpt.label || matchedOpt.optionText : rawVal)
      .toLowerCase()
      .trim();
    if (candidate === 'true' || candidate === 't' || candidate === '1') return true;
    if (candidate === 'false' || candidate === 'f' || candidate === '0') return false;
    return null;
  }

  // MultipleSelect / DynamicImage / Hotspot / HighLight -> number[]
  if (
    baseType === 'multipleselect' ||
    baseType === 'multipleresponse' ||
    baseType === 'selectallthatapply' ||
    baseType === 'sata' ||
    baseType === 'dynamicimage' ||
    baseType === 'imagebased' ||
    baseType === 'hotspot' ||
    baseType === 'highlight'
  ) {
    let ids = [];
    if (Array.isArray(parsed)) {
      ids = parsed.map(String);
    } else if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed.SelectedOptionIds)) ids = parsed.SelectedOptionIds.map(String);
      else if (Array.isArray(parsed.selectedOptionIds)) ids = parsed.selectedOptionIds.map(String);
      else if (parsed.SelectedOptionId) ids = [String(parsed.SelectedOptionId)];
    }
    if (ids.length === 0) return [];
    return ids.map((id) => resolveOptionNumericId(q, id));
  }

  // MultipleImage -> number[]
  if (baseType === 'multipleimage' || baseType === 'multipleimageselection') {
    let ids = [];
    if (Array.isArray(parsed)) {
      ids = parsed.map(String);
    } else if (typeof parsed === 'object' && parsed !== null) {
      const list = parsed.SelectedMediaIds ?? parsed.SelectedOptionIds ?? parsed.selectedOptionIds;
      if (Array.isArray(list)) ids = list.map(String);
    }
    return ids.map((id) => {
      const media = (q.media || []).find((m) => m.id === id || String(m.numericId) === id);
      if (media && media.numericId !== undefined) return media.numericId;
      return resolveOptionNumericId(q, id);
    });
  }

  // OrderingItem / OrderingDragDrop
  if (baseType === 'orderingitem' || baseType === 'orderingdragdrop' || baseType === 'orderedresponse') {
    const rawList = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.OrderedOptionIds)
        ? parsed.OrderedOptionIds
        : [];
    return rawList.map((id) => resolveOptionNumericId(q, String(id)));
  }

  // OrderingNumber -> Record<number, string>
  if (baseType === 'orderingnumber') {
    const mapObj =
      typeof parsed === 'object' && parsed !== null && parsed.OrderingNumbers
        ? parsed.OrderingNumbers
        : typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.OrderedOptionIds)
          ? Object.fromEntries(parsed.OrderedOptionIds.map((id, i) => [String(id), String(i + 1)]))
          : parsed;
    const out = {};
    for (const [k, v] of Object.entries(mapObj || {})) {
      out[String(resolveOptionNumericId(q, k))] = String(v ?? '');
    }
    return out;
  }

  // Matching -> Record<number, string>
  if (baseType === 'matching' && typeof parsed === 'object' && parsed !== null) {
    const pairs = parsed.Pairs ?? parsed;
    const out = {};
    for (const [k, v] of Object.entries(pairs || {})) {
      if (v === null || v === undefined || v === '') continue;
      const valStr = String(v);
      const targetOpt = (q.options || []).find((o) => o.id === valStr);
      out[String(resolveOptionNumericId(q, k))] = targetOpt?.optionText ?? valStr;
    }
    return out;
  }

  // BlankSelect -> Record<string, number | null>
  if (baseType === 'blankselect' && typeof parsed === 'object' && parsed !== null) {
    const map = parsed.BlankSelections ?? parsed;
    const out = {};
    for (const [blankNum, val] of Object.entries(map || {})) {
      out[blankNum] = val ? resolveOptionNumericId(q, String(val)) : null;
    }
    return out;
  }

  // BlankFill -> Record<string, string>
  if (baseType === 'blankfill' || baseType === 'fillintheblank' || baseType === 'cloze') {
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.BlankFills && typeof parsed.BlankFills === 'object') {
        return parsed.BlankFills;
      }
      if (typeof parsed.TextResponse === 'string') {
        return { blank1: parsed.TextResponse };
      }
    }
    return { blank1: String(parsed) };
  }

  // NumericResponse / OpenEnded -> string
  if (baseType === 'numericresponse' || baseType === 'numericcalculation') {
    if (typeof parsed === 'object' && parsed !== null) {
      return String(parsed.NumericResponse ?? parsed.numericResponse ?? parsed.NumericValue ?? parsed.value ?? '');
    }
    return String(parsed);
  }
  if (baseType === 'openended' || baseType === 'shortanswer' || baseType === 'extendedresponse') {
    if (typeof parsed === 'object' && parsed !== null) {
      return String(parsed.EssayResponse ?? parsed.TextResponse ?? parsed.text ?? '');
    }
    return String(parsed);
  }

  // MatrixSingleChoice -> cell ID
  if (baseType === 'matrixsinglechoice' || baseType === 'matrixgrid') {
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.SelectedCellId !== undefined) return toNumericId(String(parsed.SelectedCellId));
      const selections = parsed.MatrixSelections;
      if (selections) {
        const firstVal = Object.values(selections).find(Boolean);
        if (firstVal) return toNumericId(firstVal);
      }
    }
    return toNumericId(String(parsed));
  }

  // MatrixMultipleSelect -> number[] cell.ids
  if (baseType === 'matrixmultipleselect') {
    if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed.SelectedCellIds)) {
        return parsed.SelectedCellIds.map((id) => toNumericId(String(id))).filter((x) => x !== null);
      }
    }
    if (Array.isArray(parsed)) {
      return parsed.map((id) => toNumericId(String(id))).filter((x) => x !== null);
    }
  }

  return typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean'
    ? parsed
    : parsed;
}

export function fromStrataSavedUserAnswer(q, savedUserAnswer) {
  if (!savedUserAnswer) return undefined;
  const { baseType } = resolveNormalizedQuestionType(q.questionType);
  const rawData = savedUserAnswer.userAnswerData?.trim();

  try {
    if (baseType === 'singlechoice' || baseType === 'multiplechoice' || baseType === 'tabularresponse') {
      if (rawData) {
        const parsed = tryParseJson(rawData);
        const optId = typeof parsed === 'object' && parsed !== null ? parsed.optionId : parsed;
        if (optId !== undefined && optId !== null && String(optId) !== '') {
          return JSON.stringify({ SelectedOptionId: String(optId) });
        }
      }
      if (savedUserAnswer.questionOptionId) {
        return JSON.stringify({ SelectedOptionId: String(savedUserAnswer.questionOptionId) });
      }
    }

    if (baseType === 'truefalse' && rawData) {
      const lower = rawData.replace(/^"(.*)"$/, '$1').toLowerCase().trim();
      const matched = (q.options || []).find(
        (o) =>
          (o.label || o.optionText || '').toLowerCase().trim() === lower ||
          (lower === 'true' && /true/i.test(o.optionText)) ||
          (lower === 'false' && /false/i.test(o.optionText))
      );
      return JSON.stringify({ value: matched?.id ?? lower });
    }

    if (
      baseType === 'multipleselect' ||
      baseType === 'multipleresponse' ||
      baseType === 'selectallthatapply' ||
      baseType === 'sata'
    ) {
      if (rawData) {
        const parsed = tryParseJson(rawData);
        if (Array.isArray(parsed)) {
          return JSON.stringify({ SelectedOptionIds: parsed.map(String) });
        }
      }
    }

    if (baseType === 'dynamicimage' || baseType === 'imagebased') {
      if (rawData) {
        const parsed = tryParseJson(rawData);
        if (Array.isArray(parsed)) {
          const ids = parsed
            .map((x) => (typeof x === 'object' && x !== null ? String(x.optionId ?? '') : String(x)))
            .filter(Boolean);
          return JSON.stringify({ SelectedOptionIds: ids });
        }
      }
    }

    if (baseType === 'multipleimage' || baseType === 'multipleimageselection') {
      if (rawData) {
        const parsed = tryParseJson(rawData);
        if (Array.isArray(parsed)) {
          const ids = parsed
            .map((x) =>
              typeof x === 'object' && x !== null ? String(x.mediaId ?? x.optionId ?? '') : String(x)
            )
            .filter(Boolean);
          return JSON.stringify({ SelectedMediaIds: ids });
        }
      }
    }

    if (baseType === 'hotspot' || baseType === 'highlight') {
      const src = rawData || savedUserAnswer.userHotspot || savedUserAnswer.userHighlight;
      if (src) {
        const parsed = tryParseJson(src);
        if (Array.isArray(parsed)) {
          return JSON.stringify({ SelectedOptionIds: parsed.map(String) });
        }
      }
    }

    if (baseType === 'numericresponse' || baseType === 'numericcalculation') {
      if (rawData) return JSON.stringify({ NumericResponse: rawData.replace(/^"(.*)"$/, '$1') });
    }

    if (baseType === 'openended' || baseType === 'shortanswer' || baseType === 'extendedresponse') {
      const textSource = savedUserAnswer.openEndedAnswer || rawData;
      if (textSource) {
        const parsed = tryParseJson(textSource);
        const text =
          typeof parsed === 'object' && parsed !== null ? String(parsed.text ?? '') : String(parsed ?? '');
        return JSON.stringify({ TextResponse: text, EssayResponse: text });
      }
    }

    if (baseType === 'matching' && rawData) {
      const parsed = tryParseJson(rawData);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const pairs = {};
        for (const [k, v] of Object.entries(parsed)) {
          const val = v && typeof v === 'object' ? String(v.selectedMatch ?? '') : String(v ?? '');
          if (val) pairs[k] = val;
        }
        return JSON.stringify({ Pairs: pairs });
      }
    }

    if (
      (baseType === 'orderingitem' || baseType === 'orderingdragdrop' || baseType === 'orderedresponse') &&
      (rawData || savedUserAnswer.userOrder)
    ) {
      const parsed = tryParseJson(rawData || savedUserAnswer.userOrder);
      if (Array.isArray(parsed)) {
        const sorted = [...parsed]
          .map((item, idx) =>
            typeof item === 'object' && item !== null
              ? { id: String(item.optionId ?? ''), order: Number(item.order ?? idx + 1) }
              : { id: String(item), order: idx + 1 }
          )
          .filter((x) => x.id)
          .sort((a, b) => a.order - b.order)
          .map((x) => x.id);
        return JSON.stringify({ OrderedOptionIds: sorted });
      }
    }

    if (baseType === 'orderingnumber' && (rawData || savedUserAnswer.userOrder)) {
      const parsed = tryParseJson(rawData || savedUserAnswer.userOrder);
      if (Array.isArray(parsed)) {
        const map = {};
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            if (item.optionId !== undefined && item.order !== undefined) {
              map[String(item.optionId)] = String(item.order);
            }
          }
        }
        return JSON.stringify({ OrderingNumbers: map });
      }
    }

    if (baseType === 'blankselect' && rawData) {
      const parsed = tryParseJson(rawData);
      if (Array.isArray(parsed)) {
        const map = {};
        for (const item of parsed) {
          if (item && typeof item === 'object' && item.blank !== undefined && item.optionId !== undefined) {
            map[String(item.blank)] = String(item.optionId);
          }
        }
        return JSON.stringify({ BlankSelections: map });
      }
    }

    if ((baseType === 'blankfill' || baseType === 'fillintheblank' || baseType === 'cloze') && rawData) {
      const parsed = tryParseJson(rawData);
      if (Array.isArray(parsed)) {
        const map = {};
        for (const item of parsed) {
          if (item && typeof item === 'object' && item.blank !== undefined) {
            map[String(item.blank)] = String(item.value ?? '');
          }
        }
        return JSON.stringify({ BlankFills: map, TextResponse: map.blank1 ?? Object.values(map)[0] ?? '' });
      }
    }

    if ((baseType === 'matrixsinglechoice' || baseType === 'matrixgrid') && (rawData || savedUserAnswer.questionMatrixCellId)) {
      const parsed = rawData ? tryParseJson(rawData) : null;
      const cellId =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed.cellId
          : savedUserAnswer.questionMatrixCellId;
      if (cellId !== undefined && cellId !== null) {
        return JSON.stringify({ SelectedCellId: String(cellId) });
      }
    }

    if (baseType === 'matrixmultipleselect' && rawData) {
      const parsed = tryParseJson(rawData);
      if (Array.isArray(parsed)) {
        return JSON.stringify({ SelectedCellIds: parsed.map(String) });
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function sameStringSet(a, b) {
  const sa = new Set(Array.from(a).map((x) => String(x).trim()).filter(Boolean));
  const sb = new Set(Array.from(b).map((x) => String(x).trim()).filter(Boolean));
  if (sa.size === 0 || sa.size !== sb.size) return false;
  for (const item of sa) {
    if (!sb.has(item)) return false;
  }
  return true;
}

export function evaluateCanonicalQuestion(q, responseJson) {
  if (!responseJson || ['null', '""', '[]', '{}', ''].includes(String(responseJson).trim())) {
    return false;
  }

  const parsed = tryParseJson(responseJson);
  if (parsed === null || parsed === '') return false;

  const { baseType } = resolveNormalizedQuestionType(q.questionType);
  const meta = q.correctAnswerMeta;
  const options = q.options || [];

  // 1. MatrixGrid / MatrixSingleChoice
  if (baseType === 'matrixsinglechoice' || baseType === 'matrixgrid') {
    const selectedCellId =
      typeof parsed === 'object' && parsed !== null
        ? String(parsed.SelectedCellId ?? '')
        : String(parsed);
    if (selectedCellId && q.matrix?.cells?.length) {
      const cell = q.matrix.cells.find((c) => c.id === selectedCellId || String(c.numericId) === selectedCellId);
      if (cell) return Boolean(cell.isCorrect);
    }
    if (selectedCellId && meta?.correctCellIds?.length) {
      return meta.correctCellIds.includes(selectedCellId);
    }
    if (typeof parsed === 'object' && parsed !== null && parsed.MatrixSelections) {
      const sel = parsed.MatrixSelections;
      return options.every((o) => {
        const expected = o.data || o.description;
        return expected ? sel[o.id] === expected : Boolean(o.isCorrect && sel[o.id]);
      });
    }
    return false;
  }

  // 2. MatrixMultipleSelect
  if (baseType === 'matrixmultipleselect') {
    const selectedCellIds =
      typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.SelectedCellIds)
        ? parsed.SelectedCellIds.map(String)
        : Array.isArray(parsed)
          ? parsed.map(String)
          : [];
    const expectedIds =
      meta?.correctCellIds && meta.correctCellIds.length > 0
        ? meta.correctCellIds
        : (q.matrix?.cells ?? []).filter((c) => c.isCorrect).map((c) => c.id);
    return sameStringSet(selectedCellIds, expectedIds);
  }

  // 3. MultipleImage
  if (baseType === 'multipleimage' || baseType === 'multipleimageselection') {
    const obj = typeof parsed === 'object' && parsed !== null ? parsed : null;
    const selectedIds = Array.isArray(parsed)
      ? parsed.map(String)
      : Array.isArray(obj?.SelectedMediaIds)
        ? obj.SelectedMediaIds.map(String)
        : Array.isArray(obj?.SelectedOptionIds)
          ? obj.SelectedOptionIds.map(String)
          : [];
    const expectedIds =
      meta?.correctMediaIds && meta.correctMediaIds.length > 0
        ? meta.correctMediaIds
        : meta?.correctOptionIds && meta.correctOptionIds.length > 0
          ? meta.correctOptionIds
          : options.filter((o) => o.isCorrect).map((o) => o.id);
    return sameStringSet(selectedIds, expectedIds);
  }

  // 4. MultipleSelect / DynamicImage / Hotspot / HighLight
  if (
    baseType === 'multipleselect' ||
    baseType === 'multipleresponse' ||
    baseType === 'selectallthatapply' ||
    baseType === 'sata' ||
    baseType === 'dynamicimage' ||
    baseType === 'hotspot' ||
    baseType === 'highlight'
  ) {
    const obj = typeof parsed === 'object' && parsed !== null ? parsed : null;
    const selectedIds = Array.isArray(parsed)
      ? parsed.map(String)
      : Array.isArray(obj?.SelectedOptionIds)
        ? obj.SelectedOptionIds.map(String)
        : Array.isArray(obj?.selectedOptionIds)
          ? obj.selectedOptionIds.map(String)
          : [];
    const expectedIds =
      meta?.correctOptionIds && meta.correctOptionIds.length > 0
        ? meta.correctOptionIds
        : options.filter((o) => o.isCorrect).map((o) => o.id);
    return sameStringSet(selectedIds, expectedIds);
  }

  // 5. TrueFalse
  if (baseType === 'truefalse') {
    const rawVal =
      typeof parsed === 'object' && parsed !== null
        ? String(parsed.value ?? parsed.SelectedOptionId ?? parsed.selectedOptionId ?? '')
        : String(parsed);
    if (!rawVal) return false;
    const matchedOpt = options.find((o) => o.id === rawVal || String(o.numericId) === rawVal);
    if (matchedOpt) return Boolean(matchedOpt.isCorrect);
    const correctOpt = options.find((o) => o.isCorrect);
    if (correctOpt) {
      return correctOpt.optionText.toLowerCase().trim() === rawVal.toLowerCase().trim();
    }
    const metaExpected = (meta?.modelAnswerHtml || meta?.expectedNumeric || '').toLowerCase().trim();
    if (metaExpected === 'true' || metaExpected === 'false') {
      return rawVal.toLowerCase().trim() === metaExpected;
    }
    return false;
  }

  // 6. NumericResponse / NumericCalculation
  if (baseType === 'numericresponse' || baseType === 'numericcalculation') {
    const rawVal =
      typeof parsed === 'object' && parsed !== null
        ? String(parsed.NumericResponse ?? parsed.numericResponse ?? parsed.NumericValue ?? parsed.value ?? '')
        : String(parsed);
    const trimmed = rawVal.trim();
    if (!trimmed) return false;
    const expected = meta?.expectedNumeric ?? options.find((o) => o.isCorrect)?.optionText;
    if (!expected) return false;
    if (trimmed === expected.trim()) return true;
    const nUser = Number(trimmed);
    const nExp = Number(expected.trim());
    return Number.isFinite(nUser) && Number.isFinite(nExp) && Math.abs(nUser - nExp) <= 0.01;
  }

  // 7. BlankFill / FillInTheBlank / Cloze
  if (baseType === 'blankfill' || baseType === 'fillintheblank' || baseType === 'cloze') {
    const obj = typeof parsed === 'object' && parsed !== null ? parsed : null;
    if (meta?.correctBlanks && Object.keys(meta.correctBlanks).length > 0) {
      const userBlanks =
        obj?.BlankFills && typeof obj.BlankFills === 'object'
          ? obj.BlankFills
          : { blank1: String(obj?.TextResponse ?? parsed) };
      return Object.entries(meta.correctBlanks).every(([key, expected]) => {
        const actual = String(userBlanks[key] ?? '').trim().toLowerCase();
        return actual.length > 0 && actual === String(expected).trim().toLowerCase();
      });
    }
    const text = String(obj?.TextResponse ?? parsed).trim().toLowerCase();
    const expected = options.find((o) => o.isCorrect)?.optionText.trim().toLowerCase();
    return Boolean(expected && text === expected);
  }

  // 8. BlankSelect
  if (baseType === 'blankselect') {
    const obj = typeof parsed === 'object' && parsed !== null ? parsed : null;
    const selections = obj?.BlankSelections ?? obj ?? {};
    if (meta?.correctBlanks && Object.keys(meta.correctBlanks).length > 0) {
      return Object.entries(meta.correctBlanks).every(([blankNum, expectedOptId]) => {
        const stripped = blankNum.replace(/^blank/i, '').trim();
        const candidate = selections[blankNum] ?? selections[stripped] ?? selections[`blank${stripped}`] ?? '';
        return String(candidate) === String(expectedOptId);
      });
    }
    return false;
  }

  // 9. Matching
  if (baseType === 'matching') {
    const obj = typeof parsed === 'object' && parsed !== null ? parsed : null;
    const pairs = obj?.Pairs ?? obj ?? {};
    if (meta?.correctMatches && Object.keys(meta.correctMatches).length > 0) {
      return Object.entries(meta.correctMatches).every(([optId, expectedDesc]) => {
        const userVal = String(pairs[optId] ?? '').trim();
        const chosenOpt = options.find((o) => o.id === userVal);
        const normalizedUser = (chosenOpt?.optionText ?? userVal).trim().toLowerCase();
        return normalizedUser === String(expectedDesc).trim().toLowerCase();
      });
    }
    const pairedOpts = options.filter((o) => o.description);
    if (pairedOpts.length > 0) {
      return pairedOpts.every(
        (o) => String(pairs[o.id] ?? '').trim().toLowerCase() === (o.description ?? '').trim().toLowerCase()
      );
    }
    return false;
  }

  // 10. Ordering
  if (
    baseType === 'orderingitem' ||
    baseType === 'orderingdragdrop' ||
    baseType === 'orderingnumber' ||
    baseType === 'orderedresponse'
  ) {
    const expectedOrder =
      meta?.correctOrderIds && meta.correctOrderIds.length > 0
        ? meta.correctOrderIds
        : options.map((o) => o.id);
    if (expectedOrder.length === 0) return false;

    const obj = typeof parsed === 'object' && parsed !== null ? parsed : null;
    let userOrder = [];
    if (Array.isArray(parsed)) {
      userOrder = parsed.map(String);
    } else if (obj && Array.isArray(obj.OrderedOptionIds)) {
      userOrder = obj.OrderedOptionIds.map(String);
    } else if (obj && obj.OrderingNumbers && typeof obj.OrderingNumbers === 'object') {
      const entries = Object.entries(obj.OrderingNumbers)
        .map(([id, rank]) => ({ id, rank: Number(rank) }))
        .filter((x) => Number.isFinite(x.rank))
        .sort((a, b) => a.rank - b.rank);
      userOrder = entries.map((x) => x.id);
    }
    if (userOrder.length !== expectedOrder.length) return false;
    return expectedOrder.every((id, idx) => userOrder[idx] === String(id));
  }

  // 11. OpenEnded / ShortAnswer / ExtendedResponse
  if (baseType === 'openended' || baseType === 'shortanswer' || baseType === 'extendedresponse') {
    const obj = typeof parsed === 'object' && parsed !== null ? parsed : null;
    const text = String(obj?.EssayResponse ?? obj?.TextResponse ?? obj?.text ?? parsed).trim();
    if (!text) return false;
    if (baseType === 'shortanswer') {
      const expected = options.find((o) => o.isCorrect)?.optionText.trim().toLowerCase();
      if (expected) return text.toLowerCase() === expected;
    }
    return text.length > 0;
  }

  // 12. Default SingleChoice / ImageBased / AudioBased / VideoBased / TabularResponse
  if (typeof parsed === 'object' && parsed !== null) {
    if (parsed.SelectedOptionId || parsed.selectedOptionId) {
      const selectedId = String(parsed.SelectedOptionId || parsed.selectedOptionId);
      const opt = options.find((o) => o.id === selectedId || String(o.numericId) === selectedId);
      return Boolean(opt?.isCorrect);
    }
    if (Array.isArray(parsed.SelectedOptionIds || parsed.selectedOptionIds)) {
      const selectedIds = parsed.SelectedOptionIds || parsed.selectedOptionIds;
      const expectedIds = options.filter((o) => o.isCorrect).map((o) => o.id);
      return sameStringSet(selectedIds.map(String), expectedIds);
    }
  }

  const scalar = String(parsed).trim();
  const directOpt = options.find((o) => o.id === scalar || String(o.numericId) === scalar);
  return Boolean(directOpt?.isCorrect);
}

export function wasCanonicalOptionSelected(optionId, responseJson) {
  if (!responseJson) return false;
  const parsed = tryParseJson(responseJson);
  if (parsed === null) return false;
  if (Array.isArray(parsed)) {
    return parsed.map(String).includes(optionId);
  }
  if (typeof parsed === 'object' && parsed !== null) {
    if (parsed.SelectedOptionId || parsed.selectedOptionId) {
      return String(parsed.SelectedOptionId || parsed.selectedOptionId) === optionId;
    }
    if (parsed.value !== undefined) {
      return String(parsed.value) === optionId;
    }
    const list = parsed.SelectedOptionIds ?? parsed.selectedOptionIds ?? parsed.SelectedMediaIds;
    if (Array.isArray(list)) {
      return list.map(String).includes(optionId);
    }
  }
  return String(parsed).trim() === optionId;
}
