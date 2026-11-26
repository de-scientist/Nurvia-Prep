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
  const isCaseStudyAlias =
    lower === 'clinicalcasestudy' ||
    lower === 'unfoldingcasestudy' ||
    lower === 'casestudy' ||
    lower === '9';
  const isCaseBased = lower.startsWith('casebased') || isCaseStudyAlias;
  const baseType = lower.startsWith('casebased')
    ? lower.slice('casebased'.length) || 'singlechoice'
    : isCaseStudyAlias
      ? 'singlechoice'
      : lower;
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

function splitBowTieOptionGroups(options) {
  const safeOptions = Array.isArray(options) ? options : [];
  const taggedActions = safeOptions.filter((o) =>
    /action/i.test(`${o.data ?? ''} ${o.label ?? ''}`)
  );
  const taggedConditions = safeOptions.filter((o) =>
    /condit|diag/i.test(`${o.data ?? ''} ${o.label ?? ''}`)
  );
  const taggedParams = safeOptions.filter((o) =>
    /param|monitor/i.test(`${o.data ?? ''} ${o.label ?? ''}`)
  );
  const hasExplicitGroups =
    taggedActions.length > 0 && taggedConditions.length > 0 && taggedParams.length > 0;
  const third = Math.max(1, Math.ceil(safeOptions.length / 3));
  return {
    actionOptions: hasExplicitGroups ? taggedActions : safeOptions.slice(0, third),
    conditionOptions: hasExplicitGroups ? taggedConditions : safeOptions.slice(third, third * 2),
    paramOptions: hasExplicitGroups ? taggedParams : safeOptions.slice(third * 2),
  };
}

function hasAnyNonEmptyValue(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).some((val) => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'number' || typeof val === 'boolean') return true;
    if (Array.isArray(val)) return val.length > 0;
    return hasAnyNonEmptyValue(val);
  });
}

export function isResponseAnswered(responseJson) {
  if (responseJson === undefined || responseJson === null) return false;
  const raw = String(responseJson).trim();
  if (!raw || ['null', '""', '[]', '{}'].includes(raw)) return false;

  const parsed = tryParseJson(raw);
  if (parsed === null || parsed === undefined) return false;
  if (typeof parsed === 'string') return parsed.trim().length > 0;
  if (typeof parsed === 'number' || typeof parsed === 'boolean') return true;
  if (Array.isArray(parsed)) return parsed.length > 0;

  if (typeof parsed === 'object') {
    if ('SelectedOptionId' in parsed || 'selectedOptionId' in parsed || 'SelectedCellId' in parsed) {
      const scalar = parsed.SelectedOptionId ?? parsed.selectedOptionId ?? parsed.SelectedCellId;
      return Boolean(scalar && String(scalar).trim().length > 0);
    }
    if ('value' in parsed && Object.keys(parsed).length === 1) {
      return parsed.value !== null && parsed.value !== undefined && String(parsed.value).trim().length > 0;
    }
    for (const arrKey of [
      'SelectedOptionIds',
      'selectedOptionIds',
      'SelectedMediaIds',
      'SelectedCellIds',
      'OrderedOptionIds',
      'orderedOptionIds',
    ]) {
      if (Array.isArray(parsed[arrKey])) {
        return parsed[arrKey].some((item) => String(item ?? '').trim().length > 0);
      }
    }
    for (const strKey of [
      'NumericResponse',
      'numericResponse',
      'NumericValue',
      'TextResponse',
      'textResponse',
      'EssayResponse',
      'essayResponse',
      'ShortAnswer',
      'shortAnswer',
      'text',
    ]) {
      if (strKey in parsed && typeof parsed[strKey] === 'string') {
        return parsed[strKey].trim().length > 0;
      }
    }
    for (const mapKey of [
      'Pairs',
      'pairs',
      'BlankSelections',
      'blankSelections',
      'BlankFills',
      'blankFills',
      'OrderingNumbers',
      'orderingNumbers',
      'TrueFalseMap',
      'trueFalseMap',
      'Buckets',
      'buckets',
      'MatrixSelections',
      'matrixSelections',
    ]) {
      if (mapKey in parsed && typeof parsed[mapKey] === 'object') {
        return hasAnyNonEmptyValue(parsed[mapKey]);
      }
    }
    if ('Actions' in parsed || 'Condition' in parsed || 'Parameters' in parsed || 'actions' in parsed || 'condition' in parsed || 'parameters' in parsed) {
      const actions = parsed.Actions ?? parsed.actions ?? [];
      const condition = parsed.Condition ?? parsed.condition ?? null;
      const parameters = parsed.Parameters ?? parsed.parameters ?? [];
      return (
        (Array.isArray(actions) && actions.length > 0) ||
        Boolean(condition && String(condition).trim().length > 0) ||
        (Array.isArray(parameters) && parameters.length > 0)
      );
    }
    return hasAnyNonEmptyValue(parsed);
  }

  return false;
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
      return Object.entries(meta.correctBlanks).every(([blankNum, expectedVal]) => {
        const stripped = blankNum.replace(/^blank/i, '').trim();
        const candidate = String(
          selections[blankNum] ?? selections[stripped] ?? selections[`blank${stripped}`] ?? ''
        ).trim();
        if (!candidate) return false;
        if (candidate === String(expectedVal).trim()) return true;
        const chosenOpt = options.find((o) => o.id === candidate || String(o.numericId) === candidate);
        return Boolean(
          chosenOpt &&
            chosenOpt.optionText.trim().toLowerCase() === String(expectedVal).trim().toLowerCase()
        );
      });
    }
    const correctByBlank = new Map();
    for (const o of options) {
      if (o.isCorrect) {
        const key = (o.label || '1').replace(/^blank/i, '').trim() || '1';
        correctByBlank.set(key, o.id);
      }
    }
    if (correctByBlank.size > 0) {
      return Array.from(correctByBlank.entries()).every(([key, expectedId]) => {
        const candidate = String(
          selections[key] ?? selections[`blank${key}`] ?? ''
        ).trim();
        return candidate === String(expectedId);
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

  // 10b. MultipleTrueFalse
  if (baseType === 'multipletruefalse') {
    if (options.length === 0 || typeof parsed !== 'object' || parsed === null) return false;
    const tfMap = parsed.TrueFalseMap ?? parsed.trueFalseMap ?? {};
    return options.every((o) => {
      const expected = o.isCorrect ? 'True' : 'False';
      return String(tfMap[o.id] ?? '').trim().toLowerCase() === expected.toLowerCase();
    });
  }

  // 10c. BowTie / DynamicLabBowTie
  if (baseType === 'bowtie' || baseType === 'dynamiclabbowtie') {
    if (options.length === 0 || typeof parsed !== 'object' || parsed === null) return false;
    const { actionOptions, conditionOptions, paramOptions } = splitBowTieOptionGroups(options);
    const expectedActions = actionOptions.filter((o) => o.isCorrect).map((o) => o.id);
    const expectedConditions = conditionOptions.filter((o) => o.isCorrect).map((o) => o.id);
    const expectedParams = paramOptions.filter((o) => o.isCorrect).map((o) => o.id);

    const userActions = Array.isArray(parsed.Actions || parsed.actions)
      ? (parsed.Actions || parsed.actions).map(String)
      : [];
    const userCondition = parsed.Condition ?? parsed.condition ?? null;
    const userParams = Array.isArray(parsed.Parameters || parsed.parameters)
      ? (parsed.Parameters || parsed.parameters).map(String)
      : [];

    const actionsOk = expectedActions.length > 0 ? sameStringSet(userActions, expectedActions) : true;
    const condOk =
      expectedConditions.length > 0
        ? Boolean(userCondition && expectedConditions.includes(String(userCondition)))
        : true;
    const paramsOk = expectedParams.length > 0 ? sameStringSet(userParams, expectedParams) : true;
    return actionsOk && condOk && paramsOk && (expectedActions.length + expectedConditions.length + expectedParams.length > 0);
  }

  // 10d. DragAndDrop (Buckets)
  if (baseType === 'draganddrop') {
    if (options.length === 0 || typeof parsed !== 'object' || parsed === null) return false;
    const buckets = parsed.Buckets ?? parsed.buckets ?? {};
    return options.every((o) => {
      const expectedBucket = String(o.data || (o.isCorrect ? 'A' : 'B')).trim().toUpperCase();
      const userBucket = String(buckets[o.id] ?? '').trim().toUpperCase();
      return userBucket.length > 0 && userBucket === expectedBucket;
    });
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

function computePlusMinusScore(selectedIds, expectedIds) {
  const expectedSet = new Set(expectedIds.map(String));
  const uniqueSelected = Array.from(new Set(selectedIds.map(String).filter(Boolean)));
  const maxPoints = Math.max(1, expectedSet.size);
  let earned = 0;
  for (const id of uniqueSelected) {
    earned += expectedSet.has(id) ? 1 : -1;
  }
  return {
    pointsAwarded: Math.max(0, Math.min(maxPoints, earned)),
    maxPoints,
    scoringRule: 'partial_credit_plus_minus',
  };
}

export function scoreCanonicalQuestion(q, responseJson) {
  const isAnswered = isResponseAnswered(responseJson);
  const { baseType } = resolveNormalizedQuestionType(q.questionType);
  const meta = q.correctAnswerMeta;
  const options = q.options || [];
  const allowPartialCredit = Boolean(q.matrix?.allowPartialCredit || meta?.allowPartialCredit);

  if (!isAnswered) {
    return {
      isAnswered: false,
      isCorrect: false,
      isPartiallyCorrect: false,
      pointsAwarded: 0,
      maxPoints: 1,
      allowPartialCredit,
      scoringRule: allowPartialCredit ? 'partial_credit_proportional' : 'all_or_nothing',
    };
  }

  if (!allowPartialCredit) {
    const isCorrect = evaluateCanonicalQuestion(q, responseJson);
    return {
      isAnswered: true,
      isCorrect,
      isPartiallyCorrect: false,
      pointsAwarded: isCorrect ? 1 : 0,
      maxPoints: 1,
      allowPartialCredit: false,
      scoringRule: 'all_or_nothing',
    };
  }

  const parsed = tryParseJson(responseJson);

  // Plus/Minus partial credit for SATA, Highlight, DynamicImage, Hotspot
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
    if (expectedIds.length > 1) {
      const res = computePlusMinusScore(selectedIds, expectedIds);
      return {
        isAnswered: true,
        isCorrect: res.pointsAwarded === res.maxPoints,
        isPartiallyCorrect: res.pointsAwarded > 0 && res.pointsAwarded < res.maxPoints,
        ...res,
        allowPartialCredit: true,
      };
    }
  }

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
    if (expectedIds.length > 1) {
      const res = computePlusMinusScore(selectedIds, expectedIds);
      return {
        isAnswered: true,
        isCorrect: res.pointsAwarded === res.maxPoints,
        isPartiallyCorrect: res.pointsAwarded > 0 && res.pointsAwarded < res.maxPoints,
        ...res,
        allowPartialCredit: true,
      };
    }
  }

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
    if (expectedIds.length > 1) {
      const res = computePlusMinusScore(selectedCellIds, expectedIds);
      return {
        isAnswered: true,
        isCorrect: res.pointsAwarded === res.maxPoints,
        isPartiallyCorrect: res.pointsAwarded > 0 && res.pointsAwarded < res.maxPoints,
        ...res,
        allowPartialCredit: true,
      };
    }
  }

  if (baseType === 'bowtie' || baseType === 'dynamiclabbowtie') {
    const { actionOptions, conditionOptions, paramOptions } = splitBowTieOptionGroups(options);
    const expectedActions = actionOptions.filter((o) => o.isCorrect).map((o) => o.id);
    const expectedConditions = conditionOptions.filter((o) => o.isCorrect).map((o) => o.id);
    const expectedParams = paramOptions.filter((o) => o.isCorrect).map((o) => o.id);
    const maxPoints =
      expectedActions.length + (expectedConditions.length > 0 ? 1 : 0) + expectedParams.length;
    if (maxPoints > 0 && typeof parsed === 'object' && parsed !== null) {
      const userActions = Array.isArray(parsed.Actions || parsed.actions)
        ? Array.from(new Set((parsed.Actions || parsed.actions).map(String)))
        : [];
      const userCondition = parsed.Condition ?? parsed.condition ?? null;
      const userParams = Array.isArray(parsed.Parameters || parsed.parameters)
        ? Array.from(new Set((parsed.Parameters || parsed.parameters).map(String)))
        : [];
      let earned = 0;
      for (const a of userActions) {
        if (expectedActions.includes(a)) earned += 1;
      }
      if (userCondition && expectedConditions.includes(String(userCondition))) {
        earned += 1;
      }
      for (const p of userParams) {
        if (expectedParams.includes(p)) earned += 1;
      }
      const pointsAwarded = Math.max(0, Math.min(maxPoints, earned));
      return {
        isAnswered: true,
        isCorrect: pointsAwarded === maxPoints,
        isPartiallyCorrect: pointsAwarded > 0 && pointsAwarded < maxPoints,
        pointsAwarded,
        maxPoints,
        allowPartialCredit: true,
        scoringRule: 'partial_credit_proportional',
      };
    }
  }

  if (baseType === 'multipletruefalse' && options.length > 0 && typeof parsed === 'object' && parsed !== null) {
    const tfMap = parsed.TrueFalseMap ?? parsed.trueFalseMap ?? {};
    const maxPoints = options.length;
    let earned = 0;
    for (const o of options) {
      const expected = o.isCorrect ? 'true' : 'false';
      if (String(tfMap[o.id] ?? '').trim().toLowerCase() === expected) earned += 1;
    }
    return {
      isAnswered: true,
      isCorrect: earned === maxPoints,
      isPartiallyCorrect: earned > 0 && earned < maxPoints,
      pointsAwarded: earned,
      maxPoints,
      allowPartialCredit: true,
      scoringRule: 'partial_credit_proportional',
    };
  }

  if (baseType === 'matching' && typeof parsed === 'object' && parsed !== null) {
    const pairs = parsed.Pairs ?? parsed ?? {};
    const expectedEntries =
      meta?.correctMatches && Object.keys(meta.correctMatches).length > 0
        ? Object.entries(meta.correctMatches)
        : options.filter((o) => o.description).map((o) => [o.id, o.description]);
    if (expectedEntries.length > 1) {
      let earned = 0;
      for (const [optId, expectedDesc] of expectedEntries) {
        const userVal = String(pairs[optId] ?? '').trim();
        const chosenOpt = options.find((o) => o.id === userVal);
        const normalizedUser = (chosenOpt?.optionText ?? userVal).trim().toLowerCase();
        if (normalizedUser && normalizedUser === String(expectedDesc).trim().toLowerCase()) {
          earned += 1;
        }
      }
      const maxPoints = expectedEntries.length;
      return {
        isAnswered: true,
        isCorrect: earned === maxPoints,
        isPartiallyCorrect: earned > 0 && earned < maxPoints,
        pointsAwarded: earned,
        maxPoints,
        allowPartialCredit: true,
        scoringRule: 'partial_credit_proportional',
      };
    }
  }

  if (baseType === 'blankselect' && meta?.correctBlanks && typeof parsed === 'object' && parsed !== null) {
    const selections = parsed.BlankSelections ?? parsed ?? {};
    const entries = Object.entries(meta.correctBlanks);
    if (entries.length > 1) {
      let earned = 0;
      for (const [blankNum, expectedVal] of entries) {
        const stripped = blankNum.replace(/^blank/i, '').trim();
        const candidate = String(
          selections[blankNum] ?? selections[stripped] ?? selections[`blank${stripped}`] ?? ''
        ).trim();
        if (!candidate) continue;
        if (candidate === String(expectedVal).trim()) {
          earned += 1;
        } else {
          const chosenOpt = options.find((o) => o.id === candidate || String(o.numericId) === candidate);
          if (chosenOpt && chosenOpt.optionText.trim().toLowerCase() === String(expectedVal).trim().toLowerCase()) {
            earned += 1;
          }
        }
      }
      const maxPoints = entries.length;
      return {
        isAnswered: true,
        isCorrect: earned === maxPoints,
        isPartiallyCorrect: earned > 0 && earned < maxPoints,
        pointsAwarded: earned,
        maxPoints,
        allowPartialCredit: true,
        scoringRule: 'partial_credit_proportional',
      };
    }
  }

  if ((baseType === 'blankfill' || baseType === 'fillintheblank' || baseType === 'cloze') && meta?.correctBlanks && typeof parsed === 'object' && parsed !== null) {
    const entries = Object.entries(meta.correctBlanks);
    if (entries.length > 1) {
      const userBlanks = parsed.BlankFills && typeof parsed.BlankFills === 'object'
        ? parsed.BlankFills
        : { blank1: String(parsed.TextResponse ?? '') };
      let earned = 0;
      for (const [key, expected] of entries) {
        const actual = String(userBlanks[key] ?? '').trim().toLowerCase();
        if (actual && actual === String(expected).trim().toLowerCase()) earned += 1;
      }
      const maxPoints = entries.length;
      return {
        isAnswered: true,
        isCorrect: earned === maxPoints,
        isPartiallyCorrect: earned > 0 && earned < maxPoints,
        pointsAwarded: earned,
        maxPoints,
        allowPartialCredit: true,
        scoringRule: 'partial_credit_proportional',
      };
    }
  }

  if (baseType === 'draganddrop' && options.length > 1 && typeof parsed === 'object' && parsed !== null) {
    const buckets = parsed.Buckets ?? parsed.buckets ?? {};
    let earned = 0;
    for (const o of options) {
      const expectedBucket = String(o.data || (o.isCorrect ? 'A' : 'B')).trim().toUpperCase();
      const userBucket = String(buckets[o.id] ?? '').trim().toUpperCase();
      if (userBucket && userBucket === expectedBucket) earned += 1;
    }
    const maxPoints = options.length;
    return {
      isAnswered: true,
      isCorrect: earned === maxPoints,
      isPartiallyCorrect: earned > 0 && earned < maxPoints,
      pointsAwarded: earned,
      maxPoints,
      allowPartialCredit: true,
      scoringRule: 'partial_credit_proportional',
    };
  }

  const isCorrect = evaluateCanonicalQuestion(q, responseJson);
  return {
    isAnswered: true,
    isCorrect,
    isPartiallyCorrect: false,
    pointsAwarded: isCorrect ? 1 : 0,
    maxPoints: 1,
    allowPartialCredit: false,
    scoringRule: 'all_or_nothing',
  };
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
    const list =
      parsed.SelectedOptionIds ??
      parsed.selectedOptionIds ??
      parsed.SelectedMediaIds ??
      parsed.OrderedOptionIds ??
      parsed.orderedOptionIds;
    if (Array.isArray(list)) {
      return list.map(String).includes(optionId);
    }
    if (parsed.BlankSelections || parsed.blankSelections) {
      const blanks = parsed.BlankSelections || parsed.blankSelections;
      if (blanks && typeof blanks === 'object') {
        return Object.values(blanks).map(String).includes(optionId);
      }
    }
    if ('Actions' in parsed || 'Condition' in parsed || 'Parameters' in parsed || 'actions' in parsed || 'condition' in parsed || 'parameters' in parsed) {
      const actions = Array.isArray(parsed.Actions || parsed.actions) ? (parsed.Actions || parsed.actions).map(String) : [];
      const condition = parsed.Condition ?? parsed.condition;
      const params = Array.isArray(parsed.Parameters || parsed.parameters) ? (parsed.Parameters || parsed.parameters).map(String) : [];
      return actions.includes(optionId) || (condition !== null && condition !== undefined && String(condition) === optionId) || params.includes(optionId);
    }
    if (parsed.TrueFalseMap || parsed.trueFalseMap) {
      const tf = parsed.TrueFalseMap || parsed.trueFalseMap;
      if (tf && typeof tf === 'object' && optionId in tf) {
        return Boolean(String(tf[optionId] ?? '').trim());
      }
    }
    if (parsed.Buckets || parsed.buckets) {
      const buckets = parsed.Buckets || parsed.buckets;
      if (buckets && typeof buckets === 'object' && optionId in buckets) {
        return Boolean(String(buckets[optionId] ?? '').trim());
      }
    }
  }
  return String(parsed).trim() === optionId;
}
