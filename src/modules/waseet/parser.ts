import 'server-only';

import type {
  WaseetFieldReview,
  WaseetMetadataCity,
  WaseetMetadataRegion,
  WaseetParseResult,
} from './types';
import { normalizeDigits, normalizePhoneForWaseet } from './order-model';

const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const ADMIN_LINE = /(?:الادار[هة]|ادار[هة]|يرجى|تنويه|اعلان|رابط|كروب|مجموعة|السلام عليكم|اهلا وسهلا)/i;
const ADDRESS_HINTS = /(?:محل[هة]|شارع|زقاق|دار|بيت|فرع|حي|مجمع|سوق|قرب|مقابل|يم|ورا|وراء|جنب|جوار|العام|مستشفى|مدرس[هة]|جامع|مطعم|صيدلي[هة])/i;

export function normalizeArabicSearch(value: unknown): string {
  return normalizeDigits(value)
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function locationComparable(value: unknown): string {
  return normalizeArabicSearch(value)
    .replace(/\b(?:محافظه|مدينه|قضاء|ناحيه|منطقه|حي|العراق)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function labelValue(lines: string[], labels: RegExp): string {
  for (const line of lines) {
    const match = line.match(labels);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return '';
}

function normalizedLines(text: string): string[] {
  return normalizeDigits(text)
    .replace(/\r/g, '')
    .split(/\n|\||•|؛/)
    .map(line => line.replace(/^\s*[-–—*]+\s*/, '').trim())
    .filter(Boolean);
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length];
}

function similarity(leftRaw: string, rightRaw: string): number {
  const left = locationComparable(leftRaw);
  const right = locationComparable(rightRaw);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return Math.min(0.98, 0.84 + ratio * 0.14);
  }

  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  const shared = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const tokenScore = shared / Math.max(leftTokens.size, rightTokens.size, 1);
  const editScore = 1 - levenshtein(left, right) / Math.max(left.length, right.length, 1);
  return Math.max(0, Math.min(1, editScore * 0.72 + tokenScore * 0.28));
}

function emptyReview<T>(): WaseetFieldReview<T> {
  return { value: null, confidence: 0, state: 'missing' };
}

function textReview(value: string, confidence: number, source?: string): WaseetFieldReview {
  const clean = value.trim();
  if (!clean) return emptyReview<string>();
  return {
    value: clean,
    confidence,
    state: confidence >= 0.82 ? 'matched' : 'review',
    source,
  };
}

interface LocationCandidate {
  id: number;
  name: string;
  score: number;
}

function rankLocations<T extends { id: number; name: string }>(
  source: string,
  options: T[],
): LocationCandidate[] {
  const normalizedSource = locationComparable(source);
  if (!normalizedSource) return [];

  return options
    .map(option => {
      const normalizedName = locationComparable(option.name);
      let score = similarity(normalizedSource, normalizedName);
      const boundary = new RegExp(`(?:^|\\s)${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`);
      if (normalizedName && boundary.test(normalizedSource)) score = Math.max(score, 0.995);
      return { id: option.id, name: option.name, score };
    })
    .filter(item => item.score >= 0.52)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function chooseLocation<T extends { id: number; name: string }>(
  source: string,
  options: T[],
): WaseetFieldReview<{ id: number; name: string }> {
  const ranked = rankLocations(source, options);
  const top = ranked[0];
  if (!top) return emptyReview<{ id: number; name: string }>();

  const margin = top.score - (ranked[1]?.score || 0);
  const certain = top.score >= 0.92 || (top.score >= 0.86 && margin >= 0.08);
  return {
    value: certain ? { id: top.id, name: top.name } : null,
    confidence: top.score,
    state: certain ? 'matched' : 'review',
    source: source.trim(),
    suggestions: ranked.map(item => ({ id: item.id, name: item.name, confidence: item.score })),
  };
}

function extractPhones(text: string): string[] {
  const candidates = normalizeDigits(text).match(/(?:\+?964|00964|0)?7\d(?:[\s().-]*\d){8}/g) || [];
  const phones: string[] = [];
  for (const candidate of candidates) {
    try {
      const normalized = normalizePhoneForWaseet(candidate);
      if (!phones.includes(normalized)) phones.push(normalized);
    } catch {
      // A candidate that resembles a phone but fails Iraqi validation is ignored.
    }
  }
  return phones.slice(0, 2);
}

function extractName(lines: string[]): WaseetFieldReview {
  const labelled = labelValue(
    lines,
    /^(?:الاسم(?:\s+الرباعي)?|اسم\s+(?:الطالب|المستلم|الزبون|العميل))\s*[:：\-]?\s*(.+)$/i,
  );
  if (labelled) return textReview(labelled, 0.99, labelled);

  const candidate = lines.find(line => {
    const clean = line.replace(/@\w+/g, '').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 6 && !ADMIN_LINE.test(clean) && !ADDRESS_HINTS.test(clean) && !/\d/.test(clean) && clean.length <= 80;
  });
  return candidate ? textReview(candidate, 0.68, candidate) : emptyReview<string>();
}

function extractPrice(lines: string[], text: string): WaseetFieldReview<number> {
  const labelled = labelValue(
    lines,
    /^(?:السعر|المبلغ|المجموع|الاجمالي|الإجمالي|مبلغ\s+التحصيل|المطلوب\s+تحصيله)\s*[:：\-]?\s*(.+)$/i,
  );
  const source = labelled || (text.match(/(?:السعر|المبلغ|المجموع|الاجمالي|الإجمالي)\s*[:：\-]?\s*([\d٠-٩۰-۹,.]+\s*(?:الف|ألف|د\.?ع|دينار)?)/i)?.[1] || '');
  if (!source) return emptyReview<number>();

  const digits = normalizeDigits(source).replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0];
  if (!digits) return emptyReview<number>();
  let amount = Number(digits);
  if (!Number.isFinite(amount) || amount <= 0) return emptyReview<number>();
  if (/(?:الف|ألف)/i.test(source) || amount < 1_000) amount *= 1_000;
  amount = Math.round(amount);
  return { value: amount, confidence: labelled ? 0.98 : 0.84, state: 'matched', source: source.trim() };
}

function extractItems(lines: string[]): WaseetFieldReview<number> {
  const source = labelValue(lines, /^(?:عدد\s+(?:القطع|الكتب|الملازم)|الكمية)\s*[:：\-]?\s*(.+)$/i);
  if (!source) return emptyReview<number>();
  const value = Number(normalizeDigits(source).match(/\d+/)?.[0]);
  if (!Number.isSafeInteger(value) || value < 1) return emptyReview<number>();
  return { value, confidence: 0.98, state: 'matched', source };
}

function extractAddress(lines: string[]): WaseetFieldReview {
  const labelled = labelValue(
    lines,
    /^(?:تفاصيل\s+العنوان|العنوان|الموقع|عنوان\s+(?:السكن|التوصيل))\s*[:：\-]?\s*(.+)$/i,
  );
  if (labelled) return textReview(labelled, 0.98, labelled);

  const addressLines = lines.filter(line => ADDRESS_HINTS.test(line) && !/^(?:اقرب|أقرب)\s+نقط[هة]/i.test(line));
  return addressLines.length > 0
    ? textReview(addressLines.slice(0, 3).join('، '), 0.74, addressLines.join(' | '))
    : emptyReview<string>();
}

function extractLocationHint(lines: string[]): WaseetFieldReview {
  const labelled = labelValue(
    lines,
    /^(?:اقرب|أقرب)\s+(?:نقط[هة]\s+)?(?:دال[هة]|علام[هة])\s*[:：\-]?\s*(.+)$/i,
  );
  if (labelled) return textReview(labelled, 0.98, labelled);

  for (const line of lines) {
    const match = line.match(/(?:^|[,،\s])((?:قرب|مقابل|يم|ورا|وراء|جنب|جوار)\s+.+)$/i);
    if (match?.[1]) return textReview(match[1], 0.76, line);
  }
  return emptyReview<string>();
}

function extractGoodsType(lines: string[]): WaseetFieldReview {
  const value = labelValue(lines, /^(?:نوع\s+(?:الطلب|البضاع[هة]|المنتج)|المنتج|الدور[هة]|الكورس)\s*[:：\-]?\s*(.+)$/i);
  return value ? textReview(value, 0.92, value) : emptyReview<string>();
}

function extractNotes(lines: string[]): WaseetFieldReview {
  const value = labelValue(lines, /^(?:ملاحظات?|ملاحظه|ملاحظة)\s*[:：\-]?\s*(.+)$/i);
  return value ? textReview(value, 0.95, value) : emptyReview<string>();
}

export function parseStudentMessage(
  rawText: string,
  cities: WaseetMetadataCity[],
  regions: WaseetMetadataRegion[],
): WaseetParseResult {
  const text = String(rawText || '').trim();
  if (!text) throw new Error('ألصق رسالة الطالب أولاً.');
  if (text.length > 12_000) throw new Error('النص أطول من الحد المسموح للتحليل.');

  const lines = normalizedLines(text);
  const phones = extractPhones(text);
  const cityLabel = labelValue(lines, /^(?:المحافظ[هة]|المدين[هة])\s*[:：\-]?\s*(.+)$/i);
  const regionLabel = labelValue(lines, /^(?:المنطق[هة]|القضاء|الناحي[هة])\s*[:：\-]?\s*(.+)$/i);
  const locationSearchSource = [cityLabel, regionLabel, text].filter(Boolean).join(' ');

  const cityReview = chooseLocation(cityLabel || locationSearchSource, cities);
  const candidateCityId = cityReview.value?.id || cityReview.suggestions?.[0]?.id;
  const cityRegions = candidateCityId ? regions.filter(region => region.cityId === candidateCityId) : regions;
  let regionReview = chooseLocation(regionLabel || locationSearchSource, cityRegions);

  // Never auto-accept a region when its city itself is still ambiguous.
  if (regionReview.state === 'matched' && cityReview.state !== 'matched') {
    regionReview = { ...regionReview, value: null, state: 'review' };
  }

  const name = extractName(lines);
  const phone1: WaseetFieldReview = phones[0]
    ? { value: phones[0], confidence: 0.99, state: 'matched', source: phones[0] }
    : emptyReview<string>();
  const phone2: WaseetFieldReview = phones[1]
    ? { value: phones[1], confidence: 0.99, state: 'matched', source: phones[1] }
    : emptyReview<string>();

  const addressDetails = extractAddress(lines);
  const locationHint = extractLocationHint(lines);
  const collectionAmount = extractPrice(lines, text);
  const itemsCount = extractItems(lines);
  const goodsType = extractGoodsType(lines);
  const merchantNotes = extractNotes(lines);

  const requiredReviews = [name, phone1, cityReview, regionReview, addressDetails];
  const warnings: string[] = [];
  if (cityReview.state === 'review') warnings.push('تم العثور على أكثر من احتمال للمحافظة؛ اخترها من قائمة الوسيط.');
  if (cityReview.state === 'matched' && regionReview.state !== 'matched') {
    warnings.push('تم التعرف على المحافظة، لكن المنطقة تحتاج اختياراً من مناطقها الرسمية.');
  }
  if (addressDetails.state !== 'matched') warnings.push('راجع تفاصيل العنوان ولا تعتمد على النص المستخرج وحده.');
  if (collectionAmount.state === 'missing') warnings.push('لم يُستخرج مبلغ مؤكد؛ سيبقى مبلغ النموذج الحالي حتى تراجعه.');

  return {
    rawText: text,
    fields: {
      studentName: name,
      phone1,
      phone2,
      city: cityReview,
      region: regionReview,
      addressDetails,
      locationHint,
      collectionAmount,
      itemsCount,
      goodsType,
      merchantNotes,
    },
    reviewRequired: requiredReviews.some(field => field.state !== 'matched'),
    warnings,
  };
}
