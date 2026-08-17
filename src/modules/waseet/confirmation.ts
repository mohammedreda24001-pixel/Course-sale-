import type { WaseetOrderRecord } from './types';

function replaceAll(template: string, keys: string[], value: string): string {
  return keys.reduce((text, key) => text.split(key).join(value), template);
}

export function buildOrderConfirmation(
  order: WaseetOrderRecord,
  template?: string,
  courseName?: string,
): string {
  const amount = Number(order.collection_amount || 0).toLocaleString('ar-IQ');
  const base = template?.trim() || `تم تثبيت الطلب ✅
الاسم: {name}
الهاتف: {phone1}
المحافظة: {city}
المنطقة: {region}
العنوان: {address}
أقرب نقطة دالة: {landmark}
المبلغ المطلوب تحصيله: {amount} د.ع
رقم الوصل: {receipt}
كود الدورة: {code}`;

  let output = base;
  output = replaceAll(output, ['{name}'], order.studentName);
  output = replaceAll(output, ['{phone1}'], order.phone1);
  output = replaceAll(output, ['{phone2}'], order.phone2 || 'لا يوجد');
  output = replaceAll(output, ['{city}'], order.waseet_city_name || 'غير محددة');
  output = replaceAll(output, ['{region}'], order.waseet_region_name || 'غير محددة');
  output = replaceAll(output, ['{address}'], order.address_details || '');
  output = replaceAll(output, ['{landmark}'], order.location_hint || 'لا يوجد');
  output = replaceAll(output, ['{amount}'], amount);
  output = replaceAll(output, ['{itemsCount}'], String(order.items_count || 1));
  output = replaceAll(output, ['{packageSize}'], order.waseet_package_size_name || 'غير محدد');
  output = replaceAll(output, ['{receipt}'], order.receiptNumber || String(order.id));
  output = replaceAll(output, ['{code}'], order.StudentVaultCode_ID || '');
  output = replaceAll(output, ['{serial}'], order.StudentVaultCode_Serial || '');
  output = replaceAll(output, ['{course}'], courseName || '');
  output = replaceAll(output, ['{waseetQr}'], order.waseet_qr_id || 'لم يُرسل بعد');
  return output;
}
