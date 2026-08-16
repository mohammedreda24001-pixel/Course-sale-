import { Order } from '@/modules/database/orders-repository';

export interface ShippingPreparation {
  recipientName: string;
  phone: string;
  secondaryPhone?: string;
  province: string;
  city: string;
  fullAddress: string;
  landmark: string;
  region: string;
  packageSize: string;
  orderValue: number;
  notes: string;
  orderReference: string;
  // Validation status
  ready: boolean;
  errors: string[];
}

const PROVINCE_CITY_MAP: Record<string, string> = {
  'بغداد': 'بغداد',
  'الناصرية ذي قار': 'الناصرية',
  'ديالى': 'بعقوبة',
  'الكوت واسط': 'الكوت',
  'كربلاء': 'كربلاء',
  'دهوك': 'دهوك',
  'بابل الحلة': 'الحلة',
  'النجف': 'النجف',
  'البصرة': 'البصرة',
  'اربيل': 'أربيل',
  'كركوك': 'كركوك',
  'السليمانية': 'السليمانية',
  'صلاح الدين': 'تكريت',
  'الانبار': 'الرمادي',
  'السماوة المثنى': 'السماوة',
  'الموصل او موصل': 'الموصل',
  'الديوانية': 'الديوانية',
  'العمارة ميسان': 'العمارة'
};

export function prepareOrderForShipping(order: Order | Record<string, any>): ShippingPreparation {
  const city = PROVINCE_CITY_MAP[order.province] || order.province;
  
  const fullAddress = [
    order.address,
    order.landmark
  ].filter(Boolean).join(' - ');

  // Validation
  const errors: string[] = [];
  if (!order.studentName || !order.studentName.trim()) errors.push('اسم الطالب مطلوب');
  if (!order.phone1 || !order.phone1.trim()) errors.push('رقم الهاتف مطلوب');
  if (!order.province || !order.province.trim()) errors.push('المحافظة مطلوبة');
  if (!order.address || !order.address.trim()) errors.push('العنوان مطلوب');

  return {
    recipientName: order.studentName,
    phone: order.phone1,
    secondaryPhone: order.phone2 || undefined,
    province: order.province,
    city,
    fullAddress,
    landmark: order.landmark || '',
    region: order.region || '',
    packageSize: order.packageSize || 'medium',
    orderValue: Number(order.totalPrice) * 1000, // Convert to dinars
    notes: [
      order.notes,
      order.internalNotes,
      `نوع المنتج: ${order.goodsType || 'كورس تعليمي'}`
    ].filter(Boolean).join(' | '),
    orderReference: `ORD-${order.id}-${order.receiptNumber || 'N/A'}`,
    ready: errors.length === 0,
    errors
  };
}

export function generateShippingLabel(shippingInfo: ShippingPreparation): string {
  return `
╔══════════════════════════════════════╗
║          📦 طلب شحن جديد              ║
╠══════════════════════════════════════╣
║ المرسل إليه: ${shippingInfo.recipientName.padEnd(28)}║
║ الهاتف: ${shippingInfo.phone.padEnd(32)}║
${shippingInfo.secondaryPhone ? `║ هاتف بديل: ${shippingInfo.secondaryPhone.padEnd(27)}║` : ''}
║ المحافظة: ${shippingInfo.province.padEnd(30)}║
║ المدينة: ${shippingInfo.city.padEnd(32)}║
║ العنوان: ${shippingInfo.fullAddress.substring(0, 30).padEnd(29)}║
║ نقطة دالة: ${shippingInfo.landmark.substring(0, 26).padEnd(26)}║
${shippingInfo.region ? `║ المنطقة: ${shippingInfo.region.padEnd(30)}║` : ''}
║ حجم الطرد: ${shippingInfo.packageSize.padEnd(28)}║
║ قيمة الطلب: ${String(shippingInfo.orderValue).padEnd(27)}║
║ رقم المرجع: ${shippingInfo.orderReference.padEnd(27)}║
╚══════════════════════════════════════╝
  `.trim();
}

export function getPackageSizeLabel(size: string): string {
  const labels: Record<string, string> = {
    'small': 'صغير (ملف/كتيب)',
    'medium': 'متوسط (كتاب عادي)',
    'large': 'كبير (علبة/حزمة)',
    'xlarge': 'كبير جداً (عدة كتب)'
  };
  
  return labels[size.toLowerCase()] || size;
}
