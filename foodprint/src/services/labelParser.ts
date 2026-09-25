/** A deliberately conservative English-label parser. Every result needs human review. */
import { matchIngredientPhrases, type IngredientRecord } from '../domain/ingredients';

export type LabelSource = 'ocr' | 'manual' | 'catalog';

export interface IngredientLabelResult {
  status: 'review' | 'needs-manual-selection' | 'empty';
  ingredients: string[];
  ingredientText: string;
  allergens: string[];
  mayContain: string[];
  warnings: string[];
  unrecognized: string[];
  hasIngredientsHeader: boolean;
  ocrConfidence?: number;
  requiresConfirmation: true;
}

export interface IngredientLabelOptions {
  source?: LabelSource;
  /** OCR character confidence is not confidence that an ingredient is present. */
  ocrConfidence?: number;
  customIngredients?: IngredientRecord[];
}

const HEADER = /\bingredients\s*[:：]\s*|(?:^|\n)\s*ingredients\s*\n/i;
const SECTION = /\b(?:may\s+contain(?:\s+traces\s+of)?|contains?|allerg(?:en|y)(?:s|\s+(?:advice|information|statement))?|for\s+allergens|nutrition(?:al)?(?:\s+(?:facts|information|values|declaration))?|typical\s+values|storage(?:\s+instructions)?|store\s+in|keep\s+(?:refrigerated|frozen)|best\s+before|use\s+by|directions(?:\s+for\s+use)?|cooking\s+instructions|preparation\s+instructions|recycling|distributed\s+by|manufactured\s+(?:by|for)|country\s+of\s+origin|net\s+(?:weight|contents)|serving\s+suggestion|ingredients\s*[:：])\b\s*[:：]?/gi;

function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function cleanToken(token: string): string {
  return token.replace(/\s+/g, ' ').replace(/^[\s:;,•·]+|[\s;,•·.]+$/g, '').trim();
}

/** Split only at the outer level so nested recipes and allergen context survive. */
export function splitIngredientList(text: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if ('([{'.includes(text[i])) depth += 1;
    if (')]}'.includes(text[i])) depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;•·]/.test(text[i])) {
      const token = cleanToken(text.slice(start, i));
      if (token) tokens.push(token);
      start = i + 1;
    }
  }
  const final = cleanToken(text.slice(start));
  if (final) tokens.push(final);
  return [...new Set(tokens)];
}

function matchingBracket(text: string, start: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const opening = text[start];
  const closing = pairs[opening];
  if (!closing) return -1;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === opening) depth += 1;
    if (text[index] === closing) depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function cleanIngredientName(value: string): string {
  return cleanToken(value)
    .replace(/^_+|_+$/g, '')
    .replace(/^contains?\s+(?:(?:less\s+than\s+)?\d+(?:\.\d+)?\s*%\s*(?:or\s+less\s+of)?\s*:?)?/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*%\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,]+|[\s:;,]+$/g, '')
    .trim();
}

/**
 * Expand compound label entries into distinct exposures for correlation analysis.
 * Both the named compound and its nested components are retained because either
 * can recur independently in a diary (for example, "pasta" and "egg").
 */
export function expandIngredientNames(ingredients: string[]): string[] {
  const expanded: string[] = [];
  const visit = (raw: string, depth = 0) => {
    if (depth > 8) return;
    const text = cleanToken(raw);
    if (!text) return;
    let cursor = 0;
    let base = '';
    const nested: string[] = [];
    while (cursor < text.length) {
      const bracket = text.slice(cursor).search(/[([{]/);
      if (bracket < 0) { base += ` ${text.slice(cursor)}`; break; }
      const start = cursor + bracket;
      base += ` ${text.slice(cursor, start)}`;
      const end = matchingBracket(text, start);
      if (end < 0) { base += ` ${text.slice(start)}`; break; }
      const inner = text.slice(start + 1, end);
      nested.push(...splitIngredientList(inner));
      cursor = end + 1;
    }
    const name = cleanIngredientName(base || text);
    if (name && !/^\d+(?:\.\d+)?\s*%?$/.test(name)) expanded.push(name);
    for (const child of nested) visit(child, depth + 1);
  };
  for (const ingredient of ingredients) visit(ingredient);
  const seen = new Set<string>();
  return expanded.filter(name => {
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface SectionMarker { start: number; end: number; kind: 'allergens' | 'traces' | 'other' }

function findSections(text: string): SectionMarker[] {
  const matches: SectionMarker[] = [];
  const regex = new RegExp(SECTION.source, SECTION.flags);
  let cursor = 0;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    while (cursor < match.index) {
      const character = text[cursor++];
      if ('([{'.includes(character)) depth += 1;
      if (')]}'.includes(character)) depth = Math.max(0, depth - 1);
    }
    // Keep "whey (contains milk)" inside its ingredient, and "contains 2% or less" in a list.
    const numericContains = /^contains?\b/i.test(match[0]) && /^\s*(?:less\s+than\s+)?\d+(?:\.\d+)?\s*%/i.test(text.slice(regex.lastIndex));
    const isHardHeading = /^(?:nutrition|typical\s+values|storage|best\s+before|use\s+by|directions|cooking|recycling|distributed|manufactured)/i.test(match[0]);
    const startsLine = text.slice(text.lastIndexOf('\n', match.index - 1) + 1, match.index).trim() === '';
    if (numericContains || (depth > 0 && !(isHardHeading && startsLine))) continue;
    const kind = /^may\s+contain/i.test(match[0]) ? 'traces' : /^contains?\b/i.test(match[0]) ? 'allergens' : 'other';
    matches.push({ start: match.index, end: regex.lastIndex, kind });
  }
  return matches;
}

function splitAllergens(value: string): string[] {
  // Stop before prose after a full stop, and remove percentage/quantity claims.
  const sentence = value.split(/[.\n]/)[0];
  return splitIngredientList(sentence.replace(/\s+(?:and|&)\s+/gi, ', '))
    .map(cleanToken).filter(token => token.length > 0 && token.length < 100);
}

export function parseIngredientLabel(text: string, options: IngredientLabelOptions = {}): IngredientLabelResult {
  const normalized = normalizeText(text);
  const header = HEADER.exec(normalized);
  const confidence = typeof options.ocrConfidence === 'number' && Number.isFinite(options.ocrConfidence)
    ? Math.max(0, Math.min(1, options.ocrConfidence)) : undefined;
  const result: IngredientLabelResult = {
    status: 'empty', ingredients: [], ingredientText: '', allergens: [], mayContain: [], warnings: [], unrecognized: [],
    hasIngredientsHeader: Boolean(header), requiresConfirmation: true,
    ...(confidence === undefined ? {} : { ocrConfidence: confidence }),
  };
  if (!normalized) {
    result.warnings.push('No readable ingredient text was found. Try a clearer photo or type the ingredients.');
    return result;
  }
  if (normalized.length > 40000) {
    result.status = 'needs-manual-selection';
    result.warnings.push('This is too much text for one label. Select just the ingredient list before continuing.');
    return result;
  }
  const body = header ? normalized.slice(header.index + header[0].length) : normalized;
  const sections = findSections(body);
  result.ingredientText = body.slice(0, sections[0]?.start ?? body.length).split('\n').map(cleanToken).filter(Boolean).join('\n');
  const rawCandidates = splitIngredientList(result.ingredientText.replace(/\n+/g, ','));
  const custom = options.customIngredients ?? [];
  if (!header && (!options.source || options.source === 'ocr')) {
    // Prefer one dense label-like line. This prevents a product name or a stray
    // marketing word elsewhere on the packet from being promoted independently.
    const lineMatches = result.ingredientText.split(/\n+/).map(line => {
      const candidates = splitIngredientList(line);
      const matched = candidates.flatMap(candidate => matchIngredientPhrases(candidate, custom));
      return { candidates, matched };
    }).filter(line => line.matched.length >= 2)
      .sort((a, b) => b.matched.length - a.matched.length || (b.matched.length / b.candidates.length) - (a.matched.length / a.candidates.length));
    const best = lineMatches[0];
    result.ingredients = best ? [...new Map(best.matched.map(record => [record.id, record.name])).values()] : [];
    result.unrecognized = best ? best.candidates.filter(candidate => matchIngredientPhrases(candidate, custom).length === 0) : [];
    if (result.ingredients.length < 2) {
      result.status = 'needs-manual-selection';
      result.ingredients = [];
      result.warnings.push('The photo did not contain a clear run of recognised ingredient phrases. Retake it closer to the list, or add missing ingredients yourself.');
      return result;
    }
  } else if (options.source === 'manual') {
    result.ingredients = rawCandidates;
  } else {
    const recognized: string[] = [];
    for (const candidate of rawCandidates) {
      const expanded = expandIngredientNames([candidate]);
      const matches = expanded.flatMap(item => matchIngredientPhrases(item, custom));
      if (matches.length) recognized.push(...matches.map(match => match.name));
      else result.unrecognized.push(candidate);
    }
    result.ingredients = [...new Set(recognized)];
  }
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    if (section.kind === 'other') continue;
    const value = body.slice(section.end, sections[index + 1]?.start ?? body.length);
    const target = section.kind === 'traces' ? result.mayContain : result.allergens;
    target.push(...splitAllergens(value));
  }
  result.allergens = [...new Set(result.allergens)];
  result.mayContain = [...new Set(result.mayContain)];
  result.status = result.ingredients.length ? 'review' : 'empty';
  result.warnings.push('Check every ingredient against the packet before saving. Text recognition and product records can miss or misread words.');
  if (confidence !== undefined && confidence < 0.8) {
    result.warnings.push('Some text was difficult to read. Retake the photo in good light or correct it manually.');
  }
  if (result.mayContain.length) {
    result.warnings.push('“May contain” describes possible cross-contact, not a confirmed ingredient. It is kept separate.');
  }
  if (result.unrecognized.length) {
    result.warnings.push(`${result.unrecognized.length} text ${result.unrecognized.length === 1 ? 'item was' : 'items were'} not recognised as ingredients and was left out. Add any genuine missing ingredient below.`);
  }
  const openBrackets = (result.ingredientText.match(/[([{]/g) ?? []).length;
  const closedBrackets = (result.ingredientText.match(/[)\]}]/g) ?? []).length;
  if (openBrackets !== closedBrackets) {
    result.warnings.push('Part of the ingredient list may be cut off: parentheses do not match. Check the whole label.');
  }
  if (result.ingredientText.length > 4000 || result.ingredients.some(token => token.length > 600)) {
    result.warnings.push('This looks unusually long. Remove any packaging text that is not part of the ingredient list.');
  }
  if (!result.ingredients.length) result.warnings.push('No catalogue ingredients were found. Try another photo or add them manually.');
  return result;
}
