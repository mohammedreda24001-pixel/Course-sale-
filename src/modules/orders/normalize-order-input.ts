export interface CreateOrderInput {
  studentName: string;
  phone1: string;
  phone2?: string;
  province: string;
  address: string;
  landmark?: string;
  basePrice?: number;
  deliveryFee?: number;
  totalPrice?: number; // For backward compatibility
  piecesCount?: number;
  hasReturn?: string;
  goodsType?: string;
  returnDescription?: string;
  receiptNumber?: string;
  notes?: string;
  courseTypeId?: number;
  internalNotes?: string;
  telegramUsername?: string;
  statusId?: number;
  region?: string;
  packageSize?: string;
}

export interface OrderUpdates {
  studentName?: string;
  phone1?: string;
  phone2?: string;
  province?: string;
  address?: string;
  landmark?: string;
  basePrice?: number;
  deliveryFee?: number;
  totalPrice?: number;
  piecesCount?: number;
  hasReturn?: string;
  goodsType?: string;
  returnDescription?: string;
  receiptNumber?: string;
  notes?: string;
  courseTypeId?: number;
  internalNotes?: string;
  telegramUsername?: string;
  statusId?: number;
  region?: string;
  packageSize?: string;
}

export function normalizeCreateOrderInput(raw: any): CreateOrderInput {
  const basePrice = Number(raw.basePrice) || 250;
  const deliveryFee = Number(raw.deliveryFee) || 0;
  
  return {
    studentName: String(raw.studentName || '').trim(),
    phone1: normalizePhone(raw.phone1),
    phone2: raw.phone2 ? normalizePhone(raw.phone2) : '',
    province: String(raw.province || '').trim(),
    address: String(raw.address || '').trim(),
    landmark: String(raw.landmark || '').trim(),
    basePrice,
    deliveryFee,
    totalPrice: raw.totalPrice ? Number(raw.totalPrice) : (basePrice + deliveryFee),
    piecesCount: Math.max(1, Number(raw.piecesCount) || 1),
    hasReturn: raw.hasReturn === 'نعم' ? 'نعم' : 'لا',
    goodsType: String(raw.goodsType || 'كورس تعليمي').trim(),
    returnDescription: String(raw.returnDescription || '').trim(),
    receiptNumber: raw.receiptNumber ? String(raw.receiptNumber).trim() : undefined,
    notes: String(raw.notes || '').trim(),
    courseTypeId: Number(raw.courseTypeId) || 1,
    internalNotes: String(raw.internalNotes || '').trim(),
    telegramUsername: String(raw.telegramUsername || '').trim().replace('@', ''),
    statusId: Number(raw.statusId) || 1,
    region: String(raw.region || '').trim(),
    packageSize: String(raw.packageSize || '').trim()
  };
}

export function normalizeOrderUpdates(raw: any, currentOrder?: any): OrderUpdates {
  const updates: OrderUpdates = {};
  
  if (raw.studentName !== undefined) updates.studentName = String(raw.studentName).trim();
  if (raw.phone1 !== undefined) updates.phone1 = normalizePhone(raw.phone1);
  if (raw.phone2 !== undefined) updates.phone2 = raw.phone2 ? normalizePhone(raw.phone2) : '';
  if (raw.province !== undefined) updates.province = String(raw.province).trim();
  if (raw.address !== undefined) updates.address = String(raw.address).trim();
  if (raw.landmark !== undefined) updates.landmark = String(raw.landmark).trim();
  if (raw.basePrice !== undefined) updates.basePrice = Number(raw.basePrice);
  if (raw.deliveryFee !== undefined) updates.deliveryFee = Number(raw.deliveryFee);
  if (raw.piecesCount !== undefined) updates.piecesCount = Math.max(1, Number(raw.piecesCount));
  if (raw.hasReturn !== undefined) updates.hasReturn = raw.hasReturn === 'نعم' ? 'نعم' : 'لا';
  if (raw.goodsType !== undefined) updates.goodsType = String(raw.goodsType).trim();
  if (raw.returnDescription !== undefined) updates.returnDescription = String(raw.returnDescription).trim();
  if (raw.receiptNumber !== undefined) updates.receiptNumber = String(raw.receiptNumber).trim();
  if (raw.notes !== undefined) updates.notes = String(raw.notes).trim();
  if (raw.courseTypeId !== undefined) updates.courseTypeId = Number(raw.courseTypeId);
  if (raw.internalNotes !== undefined) updates.internalNotes = String(raw.internalNotes).trim();
  if (raw.telegramUsername !== undefined) updates.telegramUsername = String(raw.telegramUsername).trim().replace('@', '');
  if (raw.statusId !== undefined) updates.statusId = Number(raw.statusId);
  if (raw.region !== undefined) updates.region = String(raw.region).trim();
  if (raw.packageSize !== undefined) updates.packageSize = String(raw.packageSize).trim();
  
  // Auto-calculate totalPrice if basePrice or deliveryFee changed
  if (updates.basePrice !== undefined || updates.deliveryFee !== undefined) {
    const bp = updates.basePrice !== undefined ? updates.basePrice : (currentOrder?.basePrice || 250);
    const df = updates.deliveryFee !== undefined ? updates.deliveryFee : (currentOrder?.deliveryFee || 0);
    updates.totalPrice = bp + df;
  } else if (raw.totalPrice !== undefined) {
    updates.totalPrice = Number(raw.totalPrice);
  }
  
  return updates;
}

function normalizePhone(phone: string): string {
  const clean = phone ? phone.trim() : '';
  if (!clean) return '';
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 9) {
    return '07' + digits.slice(-9);
  }
  return clean;
}
