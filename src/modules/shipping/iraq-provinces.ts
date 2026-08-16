export interface IraqProvince {
  id: string;
  name: string;
  nameEn: string;
  region: string;
}

export const IRAQ_PROVINCES: IraqProvince[] = [
  { id: 'baghdad', name: 'بغداد', nameEn: 'Baghdad', region: 'center' },
  { id: 'basra', name: 'البصرة', nameEn: 'Basra', region: 'south' },
  { id: 'ninawa', name: 'الموصل', nameEn: 'Nineveh', region: 'north' },
  { id: 'erbil', name: 'اربيل', nameEn: 'Erbil', region: 'kurdistan' },
  { id: 'sulaymaniyah', name: 'السليمانية', nameEn: 'Sulaymaniyah', region: 'kurdistan' },
  { id: 'duhok', name: 'دهوك', nameEn: 'Duhok', region: 'kurdistan' },
  { id: 'karbala', name: 'كربلاء', nameEn: 'Karbala', region: 'center' },
  { id: 'najaf', name: 'النجف', nameEn: 'Najaf', region: 'center' },
  { id: 'babil', name: 'بابل الحلة', nameEn: 'Babil', region: 'center' },
  { id: 'wasit', name: 'الكوت واسط', nameEn: 'Wasit', region: 'center' },
  { id: 'diyala', name: 'ديالى', nameEn: 'Diyala', region: 'center' },
  { id: 'salahuddin', name: 'صلاح الدين', nameEn: 'Salahuddin', region: 'center' },
  { id: 'anbar', name: 'الانبار', nameEn: 'Anbar', region: 'west' },
  { id: 'thi_qar', name: 'الناصرية ذي قار', nameEn: "Dhi Qar", region: 'south' },
  { id: 'maysan', name: 'العمارة ميسان', nameEn: 'Maysan', region: 'south' },
  { id: 'muthanna', name: 'السماوة المثنى', nameEn: 'Muthanna', region: 'south' },
  { id: 'diwaniyah', name: 'الديوانية', nameEn: 'Diwaniyah', region: 'south' }
];

export const REGIONS = [
  { id: 'center', name: 'الوسط', provinces: ['بغداد', 'كربلاء', 'النجف', 'بابل الحلة', 'الكوت واسط', 'ديالى', 'صلاح الدين', 'الديوانية'] },
  { id: 'south', name: 'الجنوب', provinces: ['البصرة', 'الناصرية ذي قار', 'العمارة ميسان', 'السماوة المثنى'] },
  { id: 'north', name: 'الشمال', provinces: ['الموصل'] },
  { id: 'kurdistan', name: 'إقليم كردستان', provinces: ['اربيل', 'السليمانية', 'دهوك'] },
  { id: 'west', name: 'الغرب', provinces: ['الانبار'] }
];

export function getProvinceByName(name: string): IraqProvince | undefined {
  return IRAQ_PROVINCES.find(p => p.name === name || p.nameEn === name);
}

export function getProvincesByRegion(regionId: string): IraqProvince[] {
  return IRAQ_PROVINCES.filter(p => p.region === regionId);
}

export function getShippingRegion(provinceName: string): string {
  const province = getProvinceByName(provinceName);
  return province?.region || 'center';
}

// Shipping cost estimation (in thousands of dinars)
export function getEstimatedShippingCost(provinceName: string, packageSize: string = 'medium'): number {
  const region = getShippingRegion(provinceName);
  
  const baseCosts: Record<string, number> = {
    'center': 5,
    'south': 8,
    'north': 10,
    'kurdistan': 12,
    'west': 7
  };
  
  const sizeMultipliers: Record<string, number> = {
    'small': 0.8,
    'medium': 1,
    'large': 1.5,
    'xlarge': 2
  };
  
  const baseCost = baseCosts[region] || baseCosts['center'];
  const multiplier = sizeMultipliers[packageSize.toLowerCase()] || 1;
  
  return Math.ceil(baseCost * multiplier);
}

// Legacy support for old province codes
export const IRAQ_PROVINCE_NAMES = IRAQ_PROVINCES.map(p => p.name);

export function getLegacyProvinceCode(name: string): string {
  const province = getProvinceByName(name);
  // Return a simple code for legacy compatibility
  return province ? province.id : name.replace(/\s+/g, '_').toLowerCase();
}

// Match province from user input with fuzzy matching
export function matchProvinceFromExplicitField(input: string): IraqProvince | null {
  if (!input || !input.trim()) return null;
  
  const trimmed = input.trim();
  
  // Exact match first
  const exactMatch = getProvinceByName(trimmed);
  if (exactMatch) return exactMatch;
  
  // Partial match
  const partialMatch = IRAQ_PROVINCES.find(p => 
    p.name.includes(trimmed) || 
    trimmed.includes(p.name) ||
    p.nameEn.toLowerCase() === trimmed.toLowerCase()
  );
  
  return partialMatch || null;
}
