// Order validation utilities
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOrder(data: {
  studentName?: string;
  phone1?: string;
  province?: string;
  address?: string;
}): ValidationResult {
  const errors: string[] = [];
  
  if (!data.studentName || !data.studentName.trim()) {
    errors.push('اسم الطالب مطلوب');
  }
  
  if (!data.phone1 || !data.phone1.trim()) {
    errors.push('رقم الهاتف مطلوب');
  } else if (!/^07\d{8}$/.test(data.phone1.replace(/\s/g, ''))) {
    errors.push('رقم الهاتف غير صالح (يجب أن يبدأ بـ 07 ويتكون من 10 أرقام)');
  }
  
  if (!data.province || !data.province.trim()) {
    errors.push('المحافظة مطلوبة');
  }
  
  if (!data.address || !data.address.trim()) {
    errors.push('العنوان مطلوب');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizePhone(phone: string): string {
  const clean = phone ? phone.trim() : '';
  if (!clean) return '';
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 9) {
    return '07' + digits.slice(-9);
  }
  return clean;
}

export function formatPrice(price: number): string {
  return (price * 1000).toLocaleString('ar-IQ'); // Convert to dinars and format
}

export function generateOrderReference(orderId: number, receiptNumber?: string): string {
  return `ORD-${orderId}-${receiptNumber || 'N/A'}`;
}
