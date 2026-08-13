const ARABIC_DIGITS: Record<string, string> = {
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
  '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
};

export function toEnglishDigits(value: unknown): string {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, d => ARABIC_DIGITS[d] ?? d);
}

export function normalizeIraqiPhone(value: unknown, required = false): string {
  const raw = toEnglishDigits(value).trim();
  if (!raw) {
    if (required) throw new Error('رقم الهاتف الأساسي مطلوب.');
    return '';
  }

  const compact = raw.replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(compact)) {
    throw new Error('رقم الهاتف يحتوي على أحرف أو رموز غير صالحة.');
  }

  let normalized = compact;
  if (normalized.startsWith('+964')) normalized = '0' + normalized.slice(4);
  else if (normalized.startsWith('964')) normalized = '0' + normalized.slice(3);

  if (!/^07\d{9}$/.test(normalized)) {
    throw new Error('رقم الهاتف يجب أن يكون 11 رقماً بصيغة 07XXXXXXXXX أو بصيغة +9647XXXXXXXXX.');
  }
  return normalized;
}

export function parseNonNegativePrice(value: unknown, fieldLabel: string): number {
  const normalized = toEnglishDigits(value).trim();
  if (normalized === '') throw new Error(`${fieldLabel} مطلوب.`);
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} يجب أن يكون رقماً صحيحاً غير سالب.`);
  }
  return parsed;
}

export function calculateOrderTotal(basePrice: unknown, deliveryFee: unknown) {
  const base = parseNonNegativePrice(basePrice, 'سعر الدورة');
  const delivery = parseNonNegativePrice(deliveryFee, 'سعر التوصيل');
  const total = base + delivery;
  if (!Number.isFinite(total) || total < 0) throw new Error('المبلغ الإجمالي غير صالح.');
  return { basePrice: base, deliveryFee: delivery, totalPrice: total };
}
