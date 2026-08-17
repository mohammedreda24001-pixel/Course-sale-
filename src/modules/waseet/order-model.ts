import 'server-only';

import { createHash } from 'node:crypto';
import type {
  WaseetCreateOrderPayload,
  WaseetOrderApiRecord,
  WaseetOrderInput,
  WaseetOrderRecord,
} from './types';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeDigits(value: unknown): string {
  return String(value ?? '')
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(EASTERN_ARABIC_DIGITS.indexOf(digit)));
}

export function normalizePhoneForWaseet(value: unknown, optional = false): string {
  const original = normalizeDigits(value).trim();
  if (!original && optional) return '';

  let digits = original.replace(/\D/g, '');
  if (digits.startsWith('00964')) digits = digits.slice(2);
  if (digits.startsWith('964')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  if (!/^7\d{9}$/.test(digits)) {
    throw new Error(
      optional
        ? 'رقم الهاتف البديل غير صالح. استخدم رقماً عراقياً مثل 07700000000.'
        : 'رقم الهاتف الأساسي غير صالح. استخدم رقماً عراقياً مثل 07700000000.',
    );
  }
  return `+964${digits}`;
}

export function phoneForDisplay(value: unknown): string {
  const normalized = String(value ?? '');
  if (/^\+9647\d{9}$/.test(normalized)) return `0${normalized.slice(4)}`;
  return normalized;
}

function positiveInteger(value: unknown, label: string, minimum = 1): number {
  const number = Number(normalizeDigits(value));
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new Error(`${label} يجب أن يكون رقماً صحيحاً لا يقل عن ${minimum}.`);
  }
  return number;
}

function requiredText(value: unknown, label: string, maxLength = 1_000): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} مطلوب.`);
  if (text.length > maxLength) throw new Error(`${label} يتجاوز الحد المسموح (${maxLength} حرف).`);
  return text;
}

function optionalText(value: unknown, maxLength = 2_000): string {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) throw new Error(`أحد الحقول النصية يتجاوز الحد المسموح (${maxLength} حرف).`);
  return text;
}

export function normalizeWaseetOrderInput(raw: Record<string, unknown>): WaseetOrderInput {
  const collectionAmount = positiveInteger(raw.collectionAmount, 'المبلغ المطلوب تحصيله');
  if (collectionAmount > 2_000_000_000) {
    throw new Error('المبلغ المطلوب تحصيله أكبر من الحد المقبول في النظام.');
  }

  return {
    studentName: requiredText(raw.studentName, 'اسم الطالب/المستلم', 256),
    phone1: normalizePhoneForWaseet(raw.phone1),
    phone2: normalizePhoneForWaseet(raw.phone2, true),
    waseetCityId: positiveInteger(raw.waseetCityId, 'محافظة الوسيط'),
    waseetRegionId: positiveInteger(raw.waseetRegionId, 'منطقة الوسيط'),
    addressDetails: requiredText(raw.addressDetails, 'تفاصيل العنوان', 1_000),
    locationHint: optionalText(raw.locationHint, 500),
    waseetPackageSizeId: positiveInteger(raw.waseetPackageSizeId, 'حجم الطرد'),
    collectionAmount,
    itemsCount: positiveInteger(raw.itemsCount, 'عدد القطع'),
    replacement: raw.replacement === true || raw.replacement === 1 || raw.replacement === '1' || raw.replacement === 'نعم',
    goodsType: requiredText(raw.goodsType || 'كورس تعليمي', 'نوع البضاعة', 256),
    merchantNotes: optionalText(raw.merchantNotes, 1_000),
    receiptNumber: optionalText(raw.receiptNumber, 100) || undefined,
    courseTypeId: positiveInteger(raw.courseTypeId, 'نوع الدورة'),
    internalNotes: optionalText(raw.internalNotes, 2_000),
    telegramUsername: optionalText(raw.telegramUsername, 100).replace(/^@/, ''),
  };
}

export function composeWaseetLocation(addressDetails: string, locationHint?: string): string {
  const address = addressDetails.trim();
  const hint = String(locationHint || '').trim();
  return hint ? `${address} — أقرب نقطة دالة: ${hint}` : address;
}

export function createWaseetPayload(
  input: WaseetOrderInput,
  resolved: {
    city: { id: number; name: string };
    region: { id: number; name: string };
    packageSize: { id: number; name: string };
  },
): WaseetCreateOrderPayload {
  return {
    client_name: input.studentName,
    client_mobile: input.phone1,
    client_mobile2: input.phone2 || undefined,
    city_id: String(resolved.city.id),
    region_id: String(resolved.region.id),
    location: composeWaseetLocation(input.addressDetails, input.locationHint),
    type_name: input.goodsType,
    items_number: input.itemsCount,
    price: input.collectionAmount,
    package_size: String(resolved.packageSize.id),
    merchant_notes: input.merchantNotes || undefined,
    replacement: input.replacement ? 1 : 0,
  };
}

export function stablePayloadHash(payload: WaseetCreateOrderPayload): string {
  const stable = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = payload[key as keyof WaseetCreateOrderPayload] ?? null;
      return result;
    }, {});
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function nullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}


function sanitizeQrLink(value: unknown): string | null {
  const raw = nullableString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.searchParams.delete('token');
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeRemoteRecord(record: WaseetOrderApiRecord): Record<string, unknown> {
  const sanitized = { ...record } as Record<string, unknown>;
  const qrLink = sanitizeQrLink(record.qr_link);
  if (qrLink) sanitized.qr_link = qrLink;
  else delete sanitized.qr_link;
  return sanitized;
}

export function shipmentUpdateFromWaseet(record: WaseetOrderApiRecord) {
  return {
    waseet_order_id: nullableString(record.id),
    waseet_qr_id: nullableString(record.qr_id),
    waseet_qr_link: sanitizeQrLink(record.qr_link),
    waseet_status_id: nullableString(record.status_id),
    waseet_status_text: nullableString(record.status),
    waseet_issue_notes: nullableString(record.issue_notes),
    waseet_company_price: nullableNumber(record.company_price),
    waseet_city_fees: nullableNumber(record.city_fees),
    waseet_merchant_price: nullableNumber(record.merchant_price),
    waseet_cash_fee: nullableNumber(record.cash_fee),
    waseet_delivery_price: nullableNumber(record.delivery_price),
    waseet_invoice_id: nullableString(record.merchant_invoice_id),
    waseet_raw: sanitizeRemoteRecord(record),
  };
}

export function toPublicOrder(order: WaseetOrderRecord): Omit<WaseetOrderRecord, 'waseet_qr_link' | 'waseet_raw'> {
  const { waseet_qr_link: _secretLink, waseet_raw: _raw, ...safeOrder } = order;
  return safeOrder;
}
