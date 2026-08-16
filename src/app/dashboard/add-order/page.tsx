'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  User, 
  Phone, 
  MapPin, 
  Map, 
  DollarSign, 
  Bookmark, 
  Copy, 
  Check, 
  AlertCircle, 
  ClipboardCheck, 
  RefreshCw, 
  Loader2, 
  FileText, 
  Hash, 
  Layers, 
  HelpCircle, 
  MessageSquare,
  Plus,
  ChevronDown,
  Trash2,
  Settings,
  X,
  Send,
  QrCode,
  Camera
} from 'lucide-react';
import { IRAQ_PROVINCE_NAMES, matchProvinceFromExplicitField } from '@/modules/shipping/iraq-provinces';

interface OrderForm {
  studentName: string;
  phone1: string;
  phone2: string;
  province: string;
  region: string;
  address: string;
  landmark: string;
  packageSize: string;
  totalPrice: number;
  basePrice: number;
  deliveryFee: number;
  freeDelivery: boolean;
  piecesCount: number;
  hasReturn: string;
  goodsType: string;
  returnDescription: string;
  receiptNumber: string;
  notes: string;
  courseTypeId: number;
  internalNotes: string;
  telegramUsername: string;
  statusId: number;
}

const DEFAULT_FORM: OrderForm = {
  studentName: '',
  phone1: '',
  phone2: '',
  province: '',
  region: '',
  address: '',
  landmark: '',
  packageSize: '',
  totalPrice: 255,
  basePrice: 250,
  deliveryFee: 5,
  freeDelivery: false,
  piecesCount: 1,
  hasReturn: 'لا',
  goodsType: 'كورس تعليمي',
  returnDescription: '',
  receiptNumber: '',
  notes: '',
  courseTypeId: 1,
  internalNotes: '',
  telegramUsername: '',
  statusId: 1,
};

const PROVINCES_SUGGESTIONS = IRAQ_PROVINCE_NAMES;

interface ParserTemplate {
  id: string;
  name: string;
  requestTemplate: string;
  studentNameLabels: string[];
  phone1Labels: string[];
  phone2Labels: string[];
  provinceLabels: string[];
  addressLabels: string[];
  landmarkLabels: string[];
  totalPriceLabels: string[];
  telegramUsernameLabels: string[];
}

const DEFAULT_PARSER_TEMPLATES: ParserTemplate[] = [
  {
    id: 'default',
    name: 'الافتراضي (معياري)',
    requestTemplate: `الاسم الرباعي:
رقم الهاتف:
رقم هاتف بديل:
المحافظة:
المنطقة:
العنوان:
أقرب نقطة دالة:
حجم الطرد:
معرف التلكرام:
السعر:`,
    studentNameLabels: ['الاسم الرباعي', 'الاسم', 'اسم الطالب', 'اسم المستلم'],
    phone1Labels: ['رقم الهاتف', 'رقم هاتف', 'الهاتف', 'رقم الموبايل', 'الموبايل', 'رقم الهاتف الأول', 'الهاتف الأول'],
    phone2Labels: ['رقم هاتف بديل', 'رقم بديل', 'هاتف بديل', 'الهاتف الثاني', 'رقم آخر', 'رقم البديل'],
    provinceLabels: ['المحافظة', 'محافظة', 'المحافظه'],
    addressLabels: ['العنوان', 'تفاصيل العنوان', 'السكن'],
    landmarkLabels: ['أقرب نقطة دالة', 'أقرب نقطة', 'اقرب نقطة دالة', 'أقرب نقطه', 'نقطة دالة', 'نقطه داله', 'نقطة الدالة'],
    totalPriceLabels: ['المبلغ', 'السعر', 'سعر الدورة', 'سعر الدوره', 'قيمة الدورة', 'قيمه الدوره', 'مجموع', 'القيمة', 'القيمه'],
    telegramUsernameLabels: ['معرف التلكرام', 'معرف التليكرام', 'معرف التلي', 'التليكرام', 'التليجرام', 'التلي', 'telegram', 'tele']
  },
  {
    id: 'social',
    name: 'تواصل اجتماعي (فيسبوك / انستغرام)',
    requestTemplate: `اسم المستلم:
رقم الموبايل:
الرقم البديل:
محافظة الطالب:
المنطقة:
العنوان الكامل:
أقرب دالة:
حجم الطرد:
معرف التلي:
سعر الكورس:`,
    studentNameLabels: ['اسم المستلم', 'المستلم', 'الاسم الكامل', 'اسم الطالب'],
    phone1Labels: ['رقم الموبايل', 'الموبايل', 'تلفون', 'رقم التلفون'],
    phone2Labels: ['الرقم البديل', 'هاتف ثاني', 'رقم ثاني'],
    provinceLabels: ['محافظة الطالب', 'المحافظة', 'محافظة'],
    addressLabels: ['العنوان الكامل', 'العنوان', 'تفاصيل السكن'],
    landmarkLabels: ['أقرب دالة', 'نقطة دالة', 'الدالة', 'اقرب دالة'],
    totalPriceLabels: ['سعر الكورس', 'المبلغ مع التوصيل', 'السعر'],
    telegramUsernameLabels: ['معرف التلي', 'معرف التليكرام', 'تليجرام', 'تلي']
  },
  {
    id: 'short',
    name: 'قالب مقتضب (سريع)',
    requestTemplate: `الاسم:
الهاتف:
المحافظة:
المنطقة:
العنوان:
حجم الطرد:
تلي:`,
    studentNameLabels: ['الاسم'],
    phone1Labels: ['الهاتف', 'رقم'],
    phone2Labels: ['بديل'],
    provinceLabels: ['المحافظة'],
    addressLabels: ['العنوان'],
    landmarkLabels: ['دالة', 'نقطة'],
    totalPriceLabels: ['السعر', 'المبلغ'],
    telegramUsernameLabels: ['تلي', 'تليكرام']
  }
];

export default function AddOrderPage() {
  const [rawText, setRawText] = useState('');
  const [formData, setFormData] = useState<OrderForm>(DEFAULT_FORM);
  const [settings, setSettings] = useState<{ requestTemplate: string; defaultOrderNote: string } | null>(null);
  
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [copiedInstruction, setCopiedInstruction] = useState(false);
  const [copiedConfirmation, setCopiedConfirmation] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [confirmedMessage, setConfirmedMessage] = useState('');
  const [assignedCode, setAssignedCode] = useState('');
  const [assignedSerial, setAssignedSerial] = useState('');
  const [shippingPreparationErrors, setShippingPreparationErrors] = useState<string[]>([]);

  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isManualCode, setIsManualCode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualSerial, setManualSerial] = useState('');

  // Course Types state
  const [courseTypes, setCourseTypes] = useState<{ id: number; name: string; defaultPrice: number }[]>([]);
  const [courseTypeOpen, setCourseTypeOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const courseRef = useRef<HTMLDivElement>(null);

  const filteredCourseTypes = (() => {
    const currentCourse = courseTypes.find(c => c.id === formData.courseTypeId);
    const query = courseSearch.trim().toLowerCase();
    if (!query || (currentCourse && currentCourse.name.toLowerCase() === query)) {
      return courseTypes;
    }
    return courseTypes.filter(c => c.name.toLowerCase().includes(query));
  })();

  // Parser Templates state
  const [templates, setTemplates] = useState<ParserTemplate[]>(DEFAULT_PARSER_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [showManageTemplatesModal, setShowManageTemplatesModal] = useState(false);
  
  // Custom template form state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');
  const [newNameLabels, setNewNameLabels] = useState('');
  const [newPhone1Labels, setNewPhone1Labels] = useState('');
  const [newPhone2Labels, setNewPhone2Labels] = useState('');
  const [newProvinceLabels, setNewProvinceLabels] = useState('');
  const [newAddressLabels, setNewAddressLabels] = useState('');
  const [newLandmarkLabels, setNewLandmarkLabels] = useState('');
  const [newPriceLabels, setNewPriceLabels] = useState('');
  const [newTelegramLabels, setNewTelegramLabels] = useState('');

  // Combobox Autocomplete State & Ref
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<{ id: number; name: string }[]>([]);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Dual Scanner States & Refs
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeScannerInstance, setBarcodeScannerInstance] = useState<any>(null);

  const [showOcrScanner, setShowOcrScanner] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const ocrVideoRef = useRef<HTMLVideoElement>(null);
  const ocrStreamRef = useRef<MediaStream | null>(null);

  // Helper to dynamically extract labels from settings request template based on placeholder variables
  const extractLabelsForField = (templateText: string, placeholder: string, fallbackLabels: string[]): string[] => {
    if (!templateText) return fallbackLabels;
    const lines = templateText.split('\n');
    const extracted: string[] = [];
    const cleanPlaceholder = placeholder.replace(/[{()}]/g, '').trim();
    const regex = new RegExp(`^(.*?)\\s*[:：-]?\\s*(?:\\{\\{|\\{)${cleanPlaceholder}(?:\\}\\}|\\})`, 'i');
    
    for (const line of lines) {
      const match = line.trim().match(regex);
      if (match && match[1].trim()) {
        extracted.push(match[1].trim());
      }
    }
    return [...extracted, ...fallbackLabels];
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [settingsRes, productsRes, courseTypesRes, receiptRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/products'),
          fetch('/api/course-types'),
          fetch('/api/orders/next-receipt')
        ]);

        let settingsData = null;
        if (settingsRes.ok) {
          settingsData = await settingsRes.json();
          setSettings(settingsData);
        }

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(productsData);
        }

        let fetchedCourseTypes: any[] = [];
        if (courseTypesRes.ok) {
          fetchedCourseTypes = await courseTypesRes.json();
          setCourseTypes(fetchedCourseTypes);
        }

        let nextReceipt = '';
        if (receiptRes.ok) {
          const receiptData = await receiptRes.json();
          nextReceipt = receiptData.nextReceiptNumber;
        }

        // State persistence: get last selections
        const lastGoodsType = localStorage.getItem('last_goods_type');
        const lastCourseTypeIdStr = localStorage.getItem('last_course_type_id');
        const lastCourseTypeId = lastCourseTypeIdStr ? Number(lastCourseTypeIdStr) : 1;

        // Auto-price based on last course type
        let lastPrice = 250;
        if (fetchedCourseTypes.length > 0) {
          const matched = fetchedCourseTypes.find(c => c.id === lastCourseTypeId);
          if (matched) {
            lastPrice = matched.defaultPrice;
          }
        }

        setFormData(prev => ({
          ...prev,
          receiptNumber: nextReceipt || prev.receiptNumber,
          notes: settingsData?.defaultOrderNote || prev.notes,
          goodsType: lastGoodsType !== null ? lastGoodsType : prev.goodsType,
          courseTypeId: lastCourseTypeId,
          basePrice: lastPrice,
          totalPrice: lastPrice + prev.deliveryFee
        }));

        // Load custom templates merged with fetched database settings
        const savedTemplates = localStorage.getItem('user_parser_templates');
        let initialTemplates = [...DEFAULT_PARSER_TEMPLATES];
        if (savedTemplates) {
          try {
            const parsed = JSON.parse(savedTemplates);
            initialTemplates = [...DEFAULT_PARSER_TEMPLATES, ...parsed];
          } catch (e) {
            console.error('Failed to load custom templates', e);
          }
        }

        if (settingsData && settingsData.requestTemplate) {
          initialTemplates = initialTemplates.map(t => {
            if (t.id === 'default') {
              return {
                ...t,
                requestTemplate: settingsData.requestTemplate
              };
            }
            return t;
          });
        }
        setTemplates(initialTemplates);

      } catch (err) {
        console.error('Failed to load initial form data', err);
      }
    }
    
    loadInitialData();
  }, []);

  // Sync courseSearch value with selected courseTypeId
  useEffect(() => {
    const currentCourse = courseTypes.find(c => c.id === formData.courseTypeId);
    if (currentCourse) {
      setCourseSearch(currentCourse.name);
    }
  }, [formData.courseTypeId, courseTypes]);

  // Filter products for combobox
  useEffect(() => {
    const query = formData.goodsType.trim().toLowerCase();
    if (!query) {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(
        products.filter(p => p.name.toLowerCase().includes(query))
      );
    }
  }, [formData.goodsType, products]);

  // Click outside Combobox listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setComboboxOpen(false);
      }
      if (courseRef.current && !courseRef.current.contains(event.target as Node)) {
        setCourseTypeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- BARCODE SCANNER LOGIC ---
  const startBarcodeScanner = async () => {
    setShowBarcodeScanner(true);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const html5QrCode = new Html5Qrcode("barcode-reader-add-order");
        setBarcodeScannerInstance(html5QrCode);
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 }
          },
          (decodedText) => {
            setManualSerial(decodedText);
            html5QrCode.stop().then(() => {
              setShowBarcodeScanner(false);
            }).catch(err => console.error(err));
          },
          (errorMessage) => {}
        );
      } catch (err) {
        console.error("Failed to start barcode scanner:", err);
        alert("فشل في تشغيل الكاميرا. يرجى التحقق من الصلاحيات.");
        setShowBarcodeScanner(false);
      }
    }, 100);
  };

  const stopBarcodeScanner = async () => {
    if (barcodeScannerInstance) {
      try {
        await barcodeScannerInstance.stop();
      } catch (err) {
        console.error(err);
      }
      setBarcodeScannerInstance(null);
    }
    setShowBarcodeScanner(false);
  };

  // --- OCR SCANNER LOGIC ---
  const startOcrScanner = async () => {
    setShowOcrScanner(true);
    setOcrError('');
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        ocrStreamRef.current = stream;
        if (ocrVideoRef.current) {
          ocrVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access camera for OCR:", err);
        setOcrError("فشل في تشغيل الكاميرا. يرجى التحقق من منح الصلاحية.");
      }
    }, 100);
  };

  const stopOcrScanner = () => {
    if (ocrStreamRef.current) {
      ocrStreamRef.current.getTracks().forEach(track => track.stop());
      ocrStreamRef.current = null;
    }
    setShowOcrScanner(false);
    setOcrLoading(false);
  };

  const captureAndExtractOcr = async () => {
    if (!ocrVideoRef.current) return;
    setOcrLoading(true);
    setOcrError('');

    try {
      const video = ocrVideoRef.current;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (videoWidth === 0 || videoHeight === 0) {
        throw new Error("الفيديو غير جاهز بعد");
      }

      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("فشل في تهيئة سياق الرسم");

      // Crop coordinates matching 60% width and 25% height of video feed
      const targetWidth = Math.min(videoWidth * 0.6, 400);
      const targetHeight = Math.min(videoHeight * 0.25, 150);
      const cropX = (videoWidth - targetWidth) / 2;
      const cropY = (videoHeight - targetHeight) / 2;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.drawImage(video, cropX, cropY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL('image/png');

      // Dynamic import of Tesseract.js to avoid Next.js SSR build issues
      const Tesseract = (await import('tesseract.js')).default;
      const result = await Tesseract.recognize(dataUrl, 'eng');

      const rawText = result.data.text || '';
      const cleanCode = rawText.replace(/[^a-zA-Z0-9-]/g, '').trim();

      if (cleanCode) {
        setManualCode(cleanCode);
        stopOcrScanner();
      } else {
        setOcrError("فشل في استخراج الكود. يرجى المحاولة مرة أخرى وتوسيط الكود في المستطيل.");
      }
    } catch (err: any) {
      console.error("OCR extraction failed:", err);
      setOcrError("حدث خطأ أثناء معالجة الصورة. يرجى المحاولة مجدداً.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleAddCustomProduct = async () => {
    const name = formData.goodsType.trim();
    if (!name) return;

    setIsAddingProduct(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(prev => [...prev, data.product].sort((a, b) => a.name.localeCompare(b.name)));
        alert('تم حفظ المنتج الجديد في المخزن بنجاح!');
      } else {
        alert(data.error || 'فشل في حفظ المنتج الجديد');
      }
    } catch (e) {
      alert('حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج المحفوظ؟')) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'فشل في حذف المنتج');
      }
    } catch (e) {
      alert('حدث خطأ في الاتصال بالخادم');
    }
  };

  const handleSaveNewTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    const newTemplate: ParserTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      requestTemplate: newTemplateText.trim() || `${newTemplateName.trim()}:\n`,
      studentNameLabels: newNameLabels.split(',').map(s => s.trim()).filter(Boolean),
      phone1Labels: newPhone1Labels.split(',').map(s => s.trim()).filter(Boolean),
      phone2Labels: newPhone2Labels.split(',').map(s => s.trim()).filter(Boolean),
      provinceLabels: newProvinceLabels.split(',').map(s => s.trim()).filter(Boolean),
      addressLabels: newAddressLabels.split(',').map(s => s.trim()).filter(Boolean),
      landmarkLabels: newLandmarkLabels.split(',').map(s => s.trim()).filter(Boolean),
      totalPriceLabels: newPriceLabels.split(',').map(s => s.trim()).filter(Boolean),
      telegramUsernameLabels: newTelegramLabels.split(',').map(s => s.trim()).filter(Boolean),
    };

    const customOnly = templates.filter(t => t.id.startsWith('custom-'));
    const updatedCustom = [...customOnly, newTemplate];
    localStorage.setItem('user_parser_templates', JSON.stringify(updatedCustom));
    setTemplates([...DEFAULT_PARSER_TEMPLATES, ...updatedCustom]);

    // Reset template editor form
    setNewTemplateName('');
    setNewTemplateText('');
    setNewNameLabels('');
    setNewPhone1Labels('');
    setNewPhone2Labels('');
    setNewProvinceLabels('');
    setNewAddressLabels('');
    setNewLandmarkLabels('');
    setNewPriceLabels('');
    
    alert('تم إضافة قالب التحليل المخصص بنجاح!');
  };

  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا القالب المخصص؟')) {
      const customOnly = templates.filter(t => t.id.startsWith('custom-') && t.id !== id);
      localStorage.setItem('user_parser_templates', JSON.stringify(customOnly));
      setTemplates([...DEFAULT_PARSER_TEMPLATES, ...customOnly]);
      if (selectedTemplateId === id) {
        setSelectedTemplateId('default');
      }
    }
  };

  const extractPhonesFromText = (text: string): string[] => {
    const arabicToWestern = (str: string) => {
      return str.replace(/[\u0660-\u0669]/g, (d) => (d.charCodeAt(0) - 1632).toString())
                .replace(/[\u06f0-\u06f9]/g, (d) => (d.charCodeAt(0) - 1776).toString());
    };
    const cleanText = arabicToWestern(text);
    const parts = cleanText.split(/[\n\r,\/;|]+/);
    const cleanPhones: string[] = [];
    for (const part of parts) {
      const matches = part.match(/\+?[\d\s-]{9,16}/g) || [];
      for (const m of matches) {
        const compact = m.replace(/[\s\-().]/g, '');
        let formatted = compact;
        if (formatted.startsWith('+964')) formatted = '0' + formatted.slice(4);
        else if (formatted.startsWith('964')) formatted = '0' + formatted.slice(3);
        if (/^07\d{9}$/.test(formatted) && !cleanPhones.includes(formatted)) {
          cleanPhones.push(formatted);
        }
      }
    }
    return cleanPhones;
  };

  const extractPhonesStrict = (text: string) => {
    const cleanPhones = extractPhonesFromText(text);
    return {
      phone1: cleanPhones[0] || '',
      phone2: cleanPhones[1] || ''
    };
  };



  const LABELS_TO_STRIP = [
    'الاسم الرباعي', 'الاسم', 'اسم الطالب', 'الاسم الكامل', 'اسم المستلم', 'المستلم',
    'رقم الهاتف', 'رقم هاتف', 'الهاتف', 'رقم الموبايل', 'الموبايل', 'رقم الهاتف الأول', 'الهاتف الأول',
    'رقم هاتف بديل', 'رقم بديل', 'هاتف بديل', 'الهاتف الثاني', 'رقم آخر', 'رقم البديل',
    'المحافظة', 'محافظة', 'المحافظه',
    'حجم الطرد', 'حجم الشحنة', 'حجم الشحن', 'package size',
    'العنوان الكامل', 'العنوان', 'تفاصيل العنوان', 'السكن', 'المنطقة', 'المنطقه',
    'أقرب نقطة دالة', 'أقرب نقطة', 'اقرب نقطة دالة', 'أقرب نقطه', 'نقطة دالة', 'نقطه داله', 'نقطة الدالة', 'الدالة', 'أقرب دالة', 'اقرب دالة',
    'سعر الكورس', 'المبلغ مع التوصيل', 'السعر', 'المبلغ', 'سعر الدورة', 'سعر الدوره', 'قيمة الدورة', 'قيمه الدوره',
    'معرف التلكرام', 'معرف التليكرام', 'معرف التلي', 'التليكرام', 'التليجرام', 'التلي', 'telegram', 'tele'
  ];

  const stripLabels = (line: string): string => {
    let cleanLine = line.trim();
    for (const label of LABELS_TO_STRIP) {
      const regex = new RegExp(`^${label}\\s*[:：-]?\\s*`, 'i');
      if (regex.test(cleanLine)) {
        cleanLine = cleanLine.replace(regex, '').trim();
        break;
      }
    }
    return cleanLine;
  };

  const parseWithTemplate = (text: string, template: ParserTemplate) => {
    const findMatch = (labels: string[]) => {
      if (!labels || labels.length === 0) return null;
      const escapedLabels = labels.map(l => l.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
      const regex = new RegExp(`(?:^|\\n)\\s*(?:${escapedLabels})\\s*[:：-]?\\s*([^\\n]+)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    const requestTemplateText = settings?.requestTemplate || '';

    // Dynamically extract prefix labels from requestTemplate using placeholders
    const nameLabels = extractLabelsForField(requestTemplateText, 'StudentName', template.studentNameLabels);
    const phone1Labels = extractLabelsForField(requestTemplateText, 'Phone1', template.phone1Labels);
    const phone2Labels = extractLabelsForField(requestTemplateText, 'Phone2', template.phone2Labels);
    const provinceLabels = extractLabelsForField(requestTemplateText, 'Province', template.provinceLabels);
    const addressLabels = extractLabelsForField(requestTemplateText, 'Address', template.addressLabels);
    const landmarkLabels = extractLabelsForField(requestTemplateText, 'Landmark', template.landmarkLabels);
    const priceLabels = extractLabelsForField(requestTemplateText, 'Price', template.totalPriceLabels);
    const telegramLabels = extractLabelsForField(requestTemplateText, 'TelegramUsername', template.telegramUsernameLabels);

    const nameVal = findMatch(nameLabels) || '';
    const phone1Val = findMatch(phone1Labels) || '';
    const phone2Val = findMatch(phone2Labels) || '';
    const provinceValRaw = findMatch(provinceLabels) || '';
    const regionValRaw = findMatch(['المنطقة', 'المنطقه', 'القضاء', 'الناحية', 'الناحيه', 'region']) || '';
    const addressValRaw = findMatch(addressLabels) || '';
    const landmarkValRaw = findMatch(landmarkLabels) || '';
    const packageSizeValRaw = findMatch(['حجم الطرد', 'حجم الشحنة', 'حجم الشحن', 'package size']) || '';
    const priceValRaw = findMatch(priceLabels) || '';
    const telegramValRaw = findMatch(telegramLabels) || '';
    const telegramVal = telegramValRaw.trim();

    // 1. Phone number extraction (Strict Rule)
    let phone1 = '';
    let phone2 = '';
    const extractedPhones = extractPhonesFromText(phone1Val + "\n" + phone2Val);
    if (extractedPhones.length > 0) {
      phone1 = extractedPhones[0] || '';
      phone2 = extractedPhones[1] || '';
    } else {
      const globalPhones = extractPhonesFromText(text);
      phone1 = globalPhones[0] || '';
      phone2 = globalPhones[1] || '';
    }

    // 2. Province strict matching. Never infer from arbitrary text/address.
    const province = matchProvinceFromExplicitField(provinceValRaw);
    const region = stripLabels(regionValRaw);
    const packageSize = stripLabels(packageSizeValRaw);

    // 3. Price clean
    const cleanPrice = (priceStr: string): number => {
      if (!priceStr) return 250;
      const easternToWestern = (str: string) => {
        return str.replace(/[\u0660-\u0669]/g, (d) => (d.charCodeAt(0) - 1632).toString());
      };
      const normalized = easternToWestern(priceStr);
      const digitMatch = normalized.replace(/[^\d]/g, '');
      if (!digitMatch) return 250;
      let val = parseInt(digitMatch, 10);
      if (val >= 10000) {
        val = Math.round(val / 1000);
      }
      return val;
    };
    const finalBasePrice = priceValRaw ? cleanPrice(priceValRaw) : 250;

    // 4. Address & Landmark extraction
    let address = addressValRaw;
    let landmark = landmarkValRaw;

    if (address && !landmark) {
      if (/نقطة دالة|نقطه داله|اقرب|أقرب|مجاور|مقابل|خلف|قرب|بجانب|فرع|الفرع/i.test(address)) {
        const parts = address.split(/[-|،,]+/);
        const addressParts: string[] = [];
        const landmarkParts: string[] = [];
        for (const part of parts) {
          if (/نقطة دالة|نقطه داله|اقرب|أقرب|مجاور|مقابل|خلف|قرب|بجانب|فرع|الفرع/i.test(part)) {
            landmarkParts.push(part.trim());
          } else {
            addressParts.push(part.trim());
          }
        }
        if (landmarkParts.length > 0) {
          address = addressParts.join(' - ');
          landmark = landmarkParts.join(' - ');
        }
      }
    }

    address = stripLabels(address);
    landmark = stripLabels(landmark);

    return {
      studentName: stripLabels(nameVal),
      phone1,
      phone2,
      province,
      region,
      address,
      landmark,
      packageSize,
      basePrice: finalBasePrice,
      totalPrice: finalBasePrice + formData.deliveryFee,
      telegramUsername: telegramVal
    };
  };

  const parseTemplatelessAI = (text: string) => {
    const arabicToWestern = (str: string) => {
      return str.replace(/[\u0660-\u0669]/g, (d) => (d.charCodeAt(0) - 1632).toString())
                .replace(/[\u06f0-\u06f9]/g, (d) => (d.charCodeAt(0) - 1776).toString());
    };
    const cleanText = arabicToWestern(text);

    // 1. Phone extraction
    const phones = extractPhonesStrict(cleanText);
    const phone1 = phones.phone1;
    const phone2 = phones.phone2;

    // 2. Province/region/package size: only explicit labeled fields are trusted.
    const explicitProvinceMatch = cleanText.match(/(?:^|\n)\s*(?:المحافظة|محافظة|المحافظه)\s*[:：-]\s*([^\n]+)/i);
    const province = matchProvinceFromExplicitField(explicitProvinceMatch?.[1] || '');
    const explicitRegionMatch = cleanText.match(/(?:^|\n)\s*(?:المنطقة|المنطقه|القضاء|الناحية|الناحيه|region)\s*[:：-]\s*([^\n]+)/i);
    const region = stripLabels(explicitRegionMatch?.[1] || '');
    const explicitPackageSizeMatch = cleanText.match(/(?:^|\n)\s*(?:حجم الطرد|حجم الشحنة|حجم الشحن|package size)\s*[:：-]\s*([^\n]+)/i);
    const packageSize = stripLabels(explicitPackageSizeMatch?.[1] || '');

    // 3. Price extraction
    let basePrice = 250;
    const priceRegex = /(\d{3}(?:,\d{3})*(?:\s*الف|\s*ألف|k)?|\d{5,6})/i;
    const priceMatch = cleanText.match(priceRegex);
    if (priceMatch) {
      let pStr = priceMatch[1].replace(/,/g, '').toLowerCase();
      if (pStr.includes('الف') || pStr.includes('ألف') || pStr.includes('k')) {
        const val = parseInt(pStr.replace(/[^\d]/g, ''), 10);
        if (!isNaN(val)) basePrice = val;
      } else {
        const val = parseInt(pStr, 10);
        if (!isNaN(val)) {
          basePrice = val >= 10000 ? Math.round(val / 1000) : val;
        }
      }
    }

    // 4. Telegram Username extraction
    let telegramUsername = '';
    const telegramLinkMatch = cleanText.match(/(?:t\.me\/|tg:\/\/resolve\?domain=)([a-zA-Z0-9_]{5,32})/i);
    if (telegramLinkMatch) {
      telegramUsername = telegramLinkMatch[1];
    } else {
      const atUsernameMatch = cleanText.match(/@[a-zA-Z0-9_]{5,32}/);
      if (atUsernameMatch) {
        telegramUsername = atUsernameMatch[0];
      } else {
        const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (/معرف|تليكرام|تليجرام|تلي|telegram/i.test(line) && !line.includes('http')) {
            const cleanLine = stripLabels(line);
            if (cleanLine && /^[a-zA-Z0-9_]{5,32}$/.test(cleanLine.replace(/^@/, ''))) {
              telegramUsername = cleanLine;
              break;
            }
          }
        }
      }
    }

    // 5. Address and Landmark extraction
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
    const remainingLines = lines.filter(line => {
      const cleanLine = stripLabels(line);
      if (!cleanLine) return false;
      if (phone1 && cleanLine.replace(/\D/g, '').includes(phone1.slice(-9))) return false;
      if (phone2 && cleanLine.replace(/\D/g, '').includes(phone2.slice(-9))) return false;
      if (telegramUsername && cleanLine.includes(telegramUsername.replace(/^@/, ''))) return false;
      if (/^\s*(?:المحافظة|محافظة|المحافظه|المنطقة|المنطقه|القضاء|الناحية|الناحيه|حجم الطرد|حجم الشحنة|حجم الشحن|package size)\s*[:：-]/i.test(line)) return false;
      if (/سعر|المبلغ|توصيل|دينار|د\.ع|\d+\s*(الف|ألف|k)/i.test(line)) return false;
      return true;
    });

    let studentName = '';
    for (const line of remainingLines) {
      const cleanLine = stripLabels(line);
      const digitsCount = cleanLine.replace(/[^\d]/g, '').length;
      if (digitsCount >= 3) continue;
      if (/محافظة|محافظه|منطقة|منطقه|قضاء|حي|شارع|سكن|نقطة|نقطه|دالة|داله|اقرب|أقرب|مجاور|مقابل|خلف/i.test(cleanLine)) continue;
      
      const words = cleanLine.split(/\s+/).filter(w => w.length > 1);
      if (words.length >= 2 && words.length <= 6) {
        studentName = cleanLine;
        break;
      }
    }

    const addressCandidates: string[] = [];
    const landmarkCandidates: string[] = [];

    for (const line of remainingLines) {
      const cleanLine = stripLabels(line);
      if (cleanLine === studentName) continue;
      
      if (/نقطة دالة|نقطه داله|اقرب|أقرب|مجاور|مقابل|خلف|قرب|بجانب|فرع|الفرع/i.test(line)) {
        landmarkCandidates.push(cleanLine);
      } else if (/محافظة|محافظه|منطقة|منطقه|قضاء|حي|شارع|سكن|العنوان/i.test(line)) {
        addressCandidates.push(cleanLine);
      } else {
        const words = cleanLine.split(/\s+/).filter(w => w.length > 1);
        if (words.length >= 2) {
          addressCandidates.push(cleanLine);
        }
      }
    }

    return {
      studentName,
      phone1,
      phone2,
      province,
      region,
      address: addressCandidates.join(' - '),
      landmark: landmarkCandidates.join(' - '),
      packageSize,
      basePrice,
      totalPrice: basePrice + formData.deliveryFee,
      telegramUsername
    };
  };

  const handleParse = () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setErrorMessage('');

    setTimeout(() => {
      try {
        let parsedData;
        if (selectedTemplateId === 'templateless-ai') {
          parsedData = parseTemplatelessAI(rawText);
        } else {
          const activeTemplate = templates.find(t => t.id === selectedTemplateId);
          if (activeTemplate) {
            parsedData = parseWithTemplate(rawText, activeTemplate);
          } else {
            parsedData = parseWithTemplate(rawText, DEFAULT_PARSER_TEMPLATES[0]);
          }
        }

        setFormData(prev => ({
          ...prev,
          ...parsedData,
          // Ensure province is always a string
          province: typeof parsedData.province === 'string' 
            ? parsedData.province 
            : (parsedData.province?.name || prev.province)
        }));

        const textarea = document.getElementById('raw-paste-area');
        if (textarea) {
          textarea.classList.add('border-swiss-lavender');
          setTimeout(() => textarea.classList.remove('border-swiss-lavender'), 1000);
        }
      } catch (err) {
        setErrorMessage('فشل في معالجة النص، يرجى ملء الحقول يدوياً');
      } finally {
        setIsParsing(false);
      }
    }, 300);
  };

  const handleCopyInstructions = () => {
    if (!settings?.requestTemplate) return;
    navigator.clipboard.writeText(settings.requestTemplate);
    setCopiedInstruction(true);
    setTimeout(() => setCopiedInstruction(false), 2000);
  };

  const handleCopyConfirmation = () => {
    if (!confirmedMessage) return;
    navigator.clipboard.writeText(confirmedMessage);
    setCopiedConfirmation(true);
    setTimeout(() => setCopiedConfirmation(false), 2000);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'totalPrice' || name === 'piecesCount' || name === 'courseTypeId' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleResetForm = () => {
    const lastGoodsType = localStorage.getItem('last_goods_type');
    const lastCourseTypeIdStr = localStorage.getItem('last_course_type_id');
    const lastCourseTypeId = lastCourseTypeIdStr ? Number(lastCourseTypeIdStr) : 1;
    
    // Auto-price based on last course type
    let lastPrice = 250;
    if (courseTypes.length > 0) {
      const matched = courseTypes.find(c => c.id === lastCourseTypeId);
      if (matched) {
        lastPrice = matched.defaultPrice;
      }
    }

    setFormData({
      ...DEFAULT_FORM,
      notes: settings?.defaultOrderNote || '',
      goodsType: lastGoodsType !== null ? lastGoodsType : DEFAULT_FORM.goodsType,
      courseTypeId: lastCourseTypeId,
      basePrice: lastPrice,
      deliveryFee: 5,
      freeDelivery: false,
      totalPrice: lastPrice + 5,
      internalNotes: ''
    });
    setRawText('');
    setErrorMessage('');
    setManualCode('');
    setManualSerial('');
    setIsManualCode(false);
    
    // Fetch next receipt number again
    fetch('/api/orders/next-receipt')
      .then(res => res.json())
      .then(data => {
        if (data.nextReceiptNumber) {
          setFormData(prev => ({ ...prev, receiptNumber: data.nextReceiptNumber }));
        }
      })
      .catch(err => console.error('Failed to reload next receipt number', err));
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!formData.studentName.trim()) {
      setErrorMessage('الرجاء إدخال اسم المستلم الرباعي');
      return;
    }
    if (!formData.phone1.trim()) {
      setErrorMessage('الرجاء إدخال رقم الهاتف الرئيسي');
      return;
    }
    if (!formData.province.trim()) {
      setErrorMessage('الرجاء تحديد المحافظة');
      return;
    }
    if (!formData.address.trim()) {
      setErrorMessage('الرجاء إدخال تفاصيل العنوان بالتفصيل');
      return;
    }

    if (isManualCode) {
      if (!manualCode.trim()) {
        setErrorMessage('الرجاء إدخال كود التفعيل اليدوي');
        return;
      }
      if (!manualSerial.trim()) {
        setErrorMessage('الرجاء إدخال الرقم التسلسلي اليدوي');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        manualCode: isManualCode ? manualCode : undefined,
        manualSerial: isManualCode ? manualSerial : undefined
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء حفظ الطلب');
      }

      // Store selections in localStorage
      localStorage.setItem('last_goods_type', formData.goodsType);
      localStorage.setItem('last_course_type_id', formData.courseTypeId.toString());

      handleResetForm();
      setConfirmedMessage(data.confirmationMessage);
      setAssignedCode(data.order.StudentVaultCode_ID);
      setAssignedSerial(data.order.StudentVaultCode_Serial);
      setShippingPreparationErrors(Array.isArray(data.shippingReadiness?.errors) ? data.shippingReadiness.errors : []);
      setShowModal(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 select-none px-4 py-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-zinc-800 pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-swiss-lavender" />
          <span>إضافة طلب جديد</span>
        </h2>
        <p className="text-zinc-400 text-sm">
          معالجة وتدقيق بيانات الشحن والمبيعات وتعيين كودات التفعيل تلقائياً طبقاً لنموذج شركة التوصيل.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column (5 Cols) - Paste Area & Template Helper */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Paste Section */}
          <div className="swiss-panel rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <label htmlFor="template-selector" className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  قالب التحليل:
                </label>
                <div className="relative">
                  <select
                    id="template-selector"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="pr-3 pl-8 py-1.5 bg-zinc-950 border border-zinc-800 text-[11px] font-bold text-swiss-lavender rounded focus:outline-none focus:border-swiss-lavender appearance-none cursor-pointer"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                    <option value="templateless-ai">الذكاء الاصطناعي (بدون قالب)</option>
                  </select>
                  <ChevronDown className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-swiss-lavender" />
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setShowManageTemplatesModal(true)}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                title="إدارة قوالب التحليل"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="raw-paste-area" className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                منطقة لصق الرسالة المنسوخة
              </label>
              <button 
                type="button"
                onClick={handleParse}
                disabled={!rawText.trim() || isParsing}
                className="text-xs px-3.5 py-1.5 swiss-btn-lavender flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isParsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>معالجة الرد</span>
              </button>
            </div>
            
            <textarea
              id="raw-paste-area"
              className="w-full h-56 swiss-input p-4 text-xs font-semibold resize-none"
              placeholder={
                selectedTemplateId === 'templateless-ai'
                  ? "الصق رد أو منشور الطالب هنا مباشرة بأي صيغة كانت، وسيقوم المحلل باستخراج الحقول المطلوبة تلقائياً..."
                  : "الصق رد الطالب هنا طبقاً للقالب المحدد..."
              }
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
          </div>

          {/* Prompt Template Helper */}
          <div className="swiss-card rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-xs text-zinc-400">
                {selectedTemplateId === 'templateless-ai' ? 'نظام التحليل الحر الذكي' : 'شكل القالب المعتمد حالياً'}
              </h4>
              {selectedTemplateId !== 'templateless-ai' && (
                <button
                  type="button"
                  onClick={() => {
                    const activeTemplate = templates.find(t => t.id === selectedTemplateId);
                    if (activeTemplate) {
                      navigator.clipboard.writeText(activeTemplate.requestTemplate);
                      setCopiedInstruction(true);
                      setTimeout(() => setCopiedInstruction(false), 2000);
                    }
                  }}
                  className="text-zinc-400 hover:text-swiss-lavender p-1 transition-colors cursor-pointer"
                  title="نسخ النموذج"
                >
                  {copiedInstruction ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
            
            {selectedTemplateId === 'templateless-ai' ? (
              <div className="text-xs text-zinc-400 leading-relaxed font-semibold">
                يقوم محرك الذكاء الاصطناعيHeuristic NLP بتحليل النص المدخل واستخلاص الحقول (الاسم، الهاتف، المحافظة، العنوان، ونقطة الدالة، والمبلغ) تلقائياً دون الحاجة لكلمات مفتاحية صارمة.
              </div>
            ) : (
              <pre className="text-xs bg-zinc-950/50 p-3 rounded border border-zinc-800 text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed select-all">
                {templates.find(t => t.id === selectedTemplateId)?.requestTemplate || ''}
              </pre>
            )}
          </div>
        </div>

        {/* Right Column: Complete Form */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmitOrder} className="swiss-panel rounded-lg p-6 space-y-8">
            <div className="border-b border-zinc-800 pb-4">
              <h3 className="font-bold text-base text-zinc-200">
                مراجعة وتوثيق شحنة التوصيل
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                تأكد من مطابقة هذه البيانات لجدول شركة الشحن لضمان توليد بوليصة الشحن بنجاح.
              </p>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800 rounded-lg text-red-300 text-xs font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Receipt Number */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  رقم الوصل (رقم الوصل الاختياري)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="receiptNumber"
                    value={formData.receiptNumber}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold"
                    placeholder="سيتم توليده تلقائياً إذا تُرك فارغاً"
                  />
                </div>
              </div>

              {/* Recipient Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  اسم المستلم (الطالب) <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="studentName"
                    value={formData.studentName}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold"
                    placeholder="الاسم الرباعي للمستلم"
                  />
                </div>
              </div>

              {/* Phone 1 */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  هاتف المستلم الأساسي (11 رقم) <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="phone1"
                    value={formData.phone1}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-sm"
                    placeholder="07XXXXXXXXX"
                  />
                </div>
              </div>

              {/* Phone 2 */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  هاتف المستلم 2 (اختياري)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Phone className="w-4 h-4 opacity-50" />
                  </div>
                  <input
                    type="text"
                    name="phone2"
                    value={formData.phone2}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-sm"
                    placeholder="رقم الهاتف البديل"
                  />
                </div>
              </div>

              {/* Telegram Username */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  معرف التلكرام (Telegram Username)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Send className="w-4 h-4 text-swiss-lavender opacity-80" />
                  </div>
                  <input
                    type="text"
                    name="telegramUsername"
                    value={formData.telegramUsername}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-sm"
                    placeholder="username أو @username"
                  />
                </div>
              </div>

              {/* Province */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  شفرة المحافظة <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Map className="w-4 h-4" />
                  </div>
                  <select
                    name="province"
                    value={formData.province}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold appearance-none bg-[#0c0c0e]"
                  >
                    <option value="">اختر المحافظة لترجمتها تلقائياً...</option>
                    {PROVINCES_SUGGESTIONS.map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Shipping Region */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  المنطقة للوسيط
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="region"
                    value={formData.region}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold"
                    placeholder="اكتب المنطقة كما هي مؤكدة، بدون تخمين"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">إذا بقيت فارغة فلن يكون الطلب جاهزاً للإرسال للوسيط.</p>
              </div>

              {/* basePrice */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  سعر الدورة بالآلاف <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    name="basePrice"
                    value={formData.basePrice}
                    onChange={(e) => {
                      const bp = Number(e.target.value) || 0;
                      setFormData(prev => ({
                        ...prev,
                        basePrice: bp,
                        totalPrice: bp + prev.deliveryFee
                      }));
                    }}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-sm"
                    placeholder="250"
                  />
                </div>
              </div>

              {/* deliveryFee */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-zinc-300">
                    سعر التوصيل بالآلاف <span className="text-swiss-lavender font-bold">*</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.freeDelivery}
                      onChange={(e) => {
                        const free = e.target.checked;
                        const fee = free ? 0 : 5;
                        setFormData(prev => ({
                          ...prev,
                          freeDelivery: free,
                          deliveryFee: fee,
                          totalPrice: prev.basePrice + fee
                        }));
                      }}
                      className="accent-swiss-lavender cursor-pointer rounded"
                    />
                    <span>توصيل مجاني</span>
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    name="deliveryFee"
                    value={formData.deliveryFee}
                    disabled={formData.freeDelivery}
                    onChange={(e) => {
                      const fee = Number(e.target.value) || 0;
                      setFormData(prev => ({
                        ...prev,
                        deliveryFee: fee,
                        totalPrice: prev.basePrice + fee
                      }));
                    }}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-sm disabled:opacity-50"
                    placeholder="5"
                  />
                </div>
              </div>

              {/* Total Price Display */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  المبلغ الإجمالي بالآلاف (تلقائي)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    readOnly
                    value={formData.totalPrice}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-sm bg-zinc-950/60 border border-zinc-850 text-emerald-400 font-bold animate-pulse"
                  />
                </div>
              </div>

              {/* Pieces Count */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  عدد القطع أجباري <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Layers className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    name="piecesCount"
                    value={formData.piecesCount}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-sm"
                    min="1"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Package Size */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  حجم الطرد للوسيط
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Layers className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="packageSize"
                    value={formData.packageSize}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold"
                    placeholder="اتركه فارغاً إذا الحجم غير مؤكد"
                  />
                </div>
              </div>

              {/* Has Return */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  يحتوي على ارجاع بضاعة؟ <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <select
                    name="hasReturn"
                    value={formData.hasReturn}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold appearance-none bg-[#0c0c0e]"
                  >
                    <option value="لا">لا</option>
                    <option value="نعم">نعم</option>
                  </select>
                </div>
              </div>

              {/* Course Type (Autocomplete Combobox) */}
              <div ref={courseRef} className="relative">
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  نوع الدورة <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={courseSearch}
                    onChange={(e) => {
                      setCourseSearch(e.target.value);
                      setCourseTypeOpen(true);
                    }}
                    onFocus={() => {
                      setCourseTypeOpen(true);
                      const currentCourse = courseTypes.find(c => c.id === formData.courseTypeId);
                      setCourseSearch(currentCourse ? currentCourse.name : '');
                    }}
                    className="w-full pr-12 pl-10 py-2.5 swiss-input text-sm font-semibold"
                    placeholder="اختر الدورة..."
                    autoComplete="off"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  
                  {/* Combobox Overlay Dropdown */}
                  {courseTypeOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-[#0e0e11] border border-zinc-800 rounded-md shadow-2xl max-h-52 overflow-y-auto divide-y divide-zinc-900/60 scrollbar-thin">
                      {filteredCourseTypes.length === 0 ? (
                        <div className="p-3 text-xs text-zinc-500 text-center font-bold">
                          لا توجد دورات مطابقة.
                        </div>
                      ) : (
                        filteredCourseTypes.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ 
                                ...prev, 
                                courseTypeId: c.id,
                                basePrice: c.defaultPrice,
                                totalPrice: c.defaultPrice + prev.deliveryFee
                              }));
                              setCourseSearch(c.name);
                              setCourseTypeOpen(false);
                            }}
                            className="w-full text-right px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-swiss-lavender/10 transition-colors flex items-center justify-between"
                          >
                            <span>{c.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">({c.defaultPrice}K)</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Goods Type (Product Autocomplete Combobox) */}
              <div ref={comboboxRef} className="relative">
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  نوع البضاعة / المنتج
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                      <FileText className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      name="goodsType"
                      value={formData.goodsType}
                      onChange={(e) => {
                        handleFormChange(e);
                        setComboboxOpen(true);
                      }}
                      onFocus={() => setComboboxOpen(true)}
                      className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold"
                      placeholder="اختر منتجاً أو اكتب واحداً"
                      autoComplete="off"
                    />
                    
                    {/* Combobox Overlay Dropdown */}
                    {comboboxOpen && (
                      <div className="absolute z-20 w-full mt-1 bg-[#0e0e11] border border-zinc-800 rounded-md shadow-2xl max-h-52 overflow-y-auto divide-y divide-zinc-900/60 scrollbar-thin">
                        {filteredProducts.length === 0 ? (
                          <div className="p-3 text-xs text-zinc-500 text-center font-bold">
                            لا توجد منتجات مطابقة. انقر [+] لحفظه.
                          </div>
                        ) : (
                          filteredProducts.map(p => (
                            <div key={p.id} className="flex items-center justify-between hover:bg-swiss-lavender/10 px-4 py-1.5 transition-colors">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, goodsType: p.name }));
                                  setComboboxOpen(false);
                                }}
                                className="flex-1 text-right text-xs font-semibold text-zinc-300 hover:text-white"
                              >
                                {p.name}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProduct(p.id);
                                }}
                                className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                                title="حذف المنتج من القائمة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomProduct}
                    disabled={isAddingProduct || !formData.goodsType.trim() || products.some(p => p.name === formData.goodsType.trim())}
                    className="px-3.5 py-2.5 swiss-btn-lavender text-xs flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title="حفظ المنتج بشكل دائم"
                  >
                    {isAddingProduct ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <Plus className="w-4 h-4 text-zinc-950" />}
                  </button>
                </div>
              </div>

              {/* Detailed Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  تفاصيل العنوان أجباري (الشارع والمنطقة ونقاط الاستلام) <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold"
                    placeholder="تفاصيل الحي / الزقاق / اسم الشارع"
                  />
                </div>
              </div>

              {/* Landmark */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  أقرب نقطة دالة <span className="text-swiss-lavender font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="landmark"
                    value={formData.landmark}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold"
                    placeholder="مدرسة / مستشفى / محل تجاري معروف"
                  />
                </div>
              </div>

              {/* Return Description */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  وصف البضاعة المسترجعة أو المستبدلة (اختياري)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                    <FileText className="w-4 h-4 opacity-50" />
                  </div>
                  <input
                    type="text"
                    name="returnDescription"
                    value={formData.returnDescription}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold"
                    placeholder="في حال كان هنالك استبدال بضاعة مسترجعة للعميل"
                  />
                </div>
              </div>

              {/* Manual Code Option */}
              <div className="md:col-span-2 border-t border-zinc-800 pt-5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isManualCode"
                    checked={isManualCode}
                    onChange={(e) => setIsManualCode(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-800 text-swiss-lavender focus:ring-swiss-lavender bg-[#0c0c0e]"
                  />
                  <label htmlFor="isManualCode" className="text-xs font-bold text-zinc-300 select-none cursor-pointer">
                    تحديد كود تفعيل دورة الطالب والسيريال يدوياً (تجاوز السحب التلقائي من المخزن)
                  </label>
                </div>
              </div>

              {isManualCode && (
                <>
                  {/* Manual Serial Number */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-2">
                      الرقم التسلسلي لكود الطالب يدوياً (Serial) <span className="text-swiss-lavender font-bold">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                          <Hash className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={manualSerial}
                          onChange={(e) => setManualSerial(e.target.value)}
                          required
                          className="w-full pr-12 pl-4 py-2.5 swiss-input text-xs font-mono font-semibold"
                          placeholder="SN-XXXXXXXX"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={startBarcodeScanner}
                        className="px-3.5 py-2.5 swiss-btn-lavender text-xs flex items-center justify-center cursor-pointer"
                        title="مسح الباركود للرقم التسلسلي"
                      >
                        <QrCode className="w-4 h-4 text-zinc-950" />
                      </button>
                    </div>
                  </div>

                  {/* Manual Code */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-2">
                      كود تفعيل دورة الطالب يدوياً (Student Course Code) <span className="text-swiss-lavender font-bold">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-r-md">
                          <Bookmark className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          required
                          className="w-full pr-12 pl-4 py-2.5 swiss-input text-xs font-mono font-semibold"
                          placeholder="CODE-XXXXX"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={startOcrScanner}
                        className="px-3.5 py-2.5 swiss-btn-lavender text-xs flex items-center justify-center cursor-pointer"
                        title="قراءة الكود بكاميرا الموبايل OCR"
                      >
                        <Camera className="w-4 h-4 text-zinc-950" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  ملاحظات الشحنة العامة (تظهر لشركة التوصيل على البوليصة)
                </label>
                <div className="relative">
                  <div className="absolute top-3 right-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-md">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold h-20 resize-none"
                    placeholder="ملاحظات تظهر لشركة التوصيل على البوليصة..."
                  />
                </div>
              </div>

              {/* Internal Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-swiss-lavender mb-2">
                  ملاحظات داخلية (خاصة بالنظام ولا تظهر لشركة التوصيل)
                </label>
                <div className="relative">
                  <div className="absolute top-3 right-3 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 bg-zinc-900/40 px-2 rounded-md">
                    <Bookmark className="w-4 h-4 text-swiss-lavender" />
                  </div>
                  <textarea
                    name="internalNotes"
                    value={formData.internalNotes}
                    onChange={handleFormChange}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-sm font-semibold h-20 resize-none"
                    placeholder="ملاحظات سرية للمشرفين والوكلاء فقط..."
                  />
                </div>
              </div>

            </div>

            <div className="flex gap-4 border-t border-zinc-800 pt-6">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 swiss-btn-lavender flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-bold"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>تثبيت الطلب ومطابقة الكود...</span>
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-5 h-5" />
                    <span>حفظ وتأكيد الطلب</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetForm}
                disabled={isSaving}
                className="px-6 py-3 swiss-btn-neutral cursor-pointer disabled:opacity-50 font-bold"
              >
                مسح البيانات
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Confirmation Modal (Swiss Minimalist Dialog) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 p-6 rounded-lg animate-zoomIn space-y-6">
            
            {/* Header */}
            <div className="text-center border-b border-zinc-800 pb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-swiss-lavender text-zinc-950 rounded-full mb-3">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-lg font-bold text-white">تم تثبيت الطلب بنجاح!</h3>
              <p className="text-xs text-zinc-400 mt-1">تم حجز الكود المتاح وتوليد رسالة التأكيد للطالب.</p>
            </div>

            {/* Shipping preparation status */}
            {shippingPreparationErrors.length === 0 ? (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-bold">
                بيانات الشحن الأساسية مكتملة وجاهزة لمرحلة ربط الوسيط.
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs font-bold space-y-1">
                <div>الطلب محفوظ، لكنه غير جاهز للإرسال للوسيط ولا توجد أي قيم افتراضية:</div>
                {shippingPreparationErrors.map((message, index) => (
                  <div key={`${message}-${index}`}>• {message}</div>
                ))}
              </div>
            )}

            {/* Code Vault Info Grid */}
            <div className="grid grid-cols-2 gap-4 bg-zinc-950/40 p-4 border border-zinc-800 rounded-lg">
              <div className="text-center p-2 border-l border-zinc-800">
                <span className="text-[10px] text-zinc-400 font-bold block mb-1">كود الطالب المخصص</span>
                <span className="font-mono font-bold text-swiss-lavender text-lg select-all">{assignedCode}</span>
              </div>
              <div className="text-center p-2">
                <span className="text-[10px] text-zinc-400 font-bold block mb-1">سيريال التفعيل</span>
                <span className="font-mono font-bold text-white text-lg select-all">{assignedSerial}</span>
              </div>
            </div>

            {/* Output Copy Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-400">الرسالة التلقائية للطالب:</span>
                <button
                  type="button"
                  onClick={handleCopyConfirmation}
                  className="px-4 py-2 swiss-btn-lavender text-xs cursor-pointer flex items-center gap-1"
                >
                  {copiedConfirmation ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedConfirmation ? 'تم النسخ!' : 'نسخ الرسالة بالكامل'}</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto bg-zinc-950/50 p-4 border border-zinc-800 rounded-lg text-xs text-zinc-300 font-semibold whitespace-pre-wrap leading-relaxed select-all">
                {confirmedMessage}
              </div>
            </div>

            {/* Close */}
            <div className="text-center border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 swiss-btn-neutral text-xs cursor-pointer w-full"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Templates Modal */}
      {showManageTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 p-6 rounded-lg max-h-[85vh] overflow-y-auto space-y-6 animate-zoomIn text-right">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-swiss-lavender" />
                <span>إدارة قوالب التحليل المخصصة</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowManageTemplatesModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Custom Templates */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-300">القوالب المخصصة المضافة حالياً:</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {templates.filter(t => t.id.startsWith('custom-')).length === 0 ? (
                  <div className="p-3 text-xs text-zinc-500 text-center bg-zinc-950/40 border border-zinc-800 rounded">
                    لم تقم بإضافة أي قوالب مخصصة بعد. استخدم النموذج أدناه لإضافة قالب جديد.
                  </div>
                ) : (
                  templates.filter(t => t.id.startsWith('custom-')).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-800 rounded-lg">
                      <span className="text-xs font-bold text-white">{t.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors cursor-pointer"
                        title="حذف القالب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add New Template Form */}
            <form onSubmit={handleSaveNewTemplate} className="space-y-4 border-t border-zinc-800 pt-4">
              <h4 className="text-xs font-bold text-swiss-lavender">إضافة قالب تحليل جديد:</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">اسم القالب (مثال: تليجرام سريع)</label>
                  <input
                    type="text"
                    required
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="أدخل اسماً مميزاً للقالب"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">كلمات مفتاحية للاسم (مفصولة بفاصلة)</label>
                  <input
                    type="text"
                    required
                    value={newNameLabels}
                    onChange={(e) => setNewNameLabels(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="الاسم، اسم الطالب، المستلم"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">كلمات مفتاحية للهاتف الأساسي</label>
                  <input
                    type="text"
                    required
                    value={newPhone1Labels}
                    onChange={(e) => setNewPhone1Labels(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="رقم الهاتف، الموبايل، الهاتف"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">كلمات مفتاحية للهاتف البديل</label>
                  <input
                    type="text"
                    value={newPhone2Labels}
                    onChange={(e) => setNewPhone2Labels(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="رقم بديل، هاتف بديل، الرقم الثاني"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">كلمات مفتاحية للمحافظة</label>
                  <input
                    type="text"
                    required
                    value={newProvinceLabels}
                    onChange={(e) => setNewProvinceLabels(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="المحافظة، محافظة"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">كلمات مفتاحية للعنوان التفصيلي</label>
                  <input
                    type="text"
                    required
                    value={newAddressLabels}
                    onChange={(e) => setNewAddressLabels(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="العنوان، السكن، تفاصيل العنوان"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">كلمات مفتاحية لنقطة الدالة</label>
                  <input
                    type="text"
                    required
                    value={newLandmarkLabels}
                    onChange={(e) => setNewLandmarkLabels(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="أقرب نقطة دالة، نقطة دالة، الدالة"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">كلمات مفتاحية للمبلغ/السعر</label>
                  <input
                    type="text"
                    value={newPriceLabels}
                    onChange={(e) => setNewPriceLabels(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="المبلغ، السعر، سعر الكورس"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">كلمات مفتاحية لمعرف التلكرام (مفصولة بفاصلة)</label>
                  <input
                    type="text"
                    value={newTelegramLabels}
                    onChange={(e) => setNewTelegramLabels(e.target.value)}
                    className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                    placeholder="معرف، تلي، تليجرام، تلكرام"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">هيكل الرسالة لنسخها للطالب (اختياري)</label>
                <textarea
                  value={newTemplateText}
                  onChange={(e) => setNewTemplateText(e.target.value)}
                  className="w-full h-20 swiss-input p-3 text-xs font-mono resize-none"
                  placeholder={`الاسم:\nالهاتف:\nالمحافظة:\nالعنوان:`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 swiss-btn-lavender text-xs cursor-pointer font-bold"
                >
                  حفظ القالب الجديد
                </button>
                <button
                  type="button"
                  onClick={() => setShowManageTemplatesModal(false)}
                  className="px-6 py-2.5 swiss-btn-neutral text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal (For Serial Number) */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 rounded-lg space-y-6 text-right select-none animate-zoomIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>ماسح الباركود للرقم التسلسلي</span>
              </h3>
              <button
                type="button"
                onClick={stopBarcodeScanner}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-square bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden flex items-center justify-center">
              <div id="barcode-reader-add-order" className="w-full h-full"></div>
              
              {/* Laser Line Overlay */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between">
                <div className="absolute left-[10%] right-[10%] top-[30%] bottom-[30%] border-2 border-dashed border-swiss-lavender/50 rounded pointer-events-none">
                  <div className="w-full h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-laserLine absolute top-0"></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={stopBarcodeScanner}
                className="px-6 py-2.5 swiss-btn-neutral text-xs cursor-pointer font-bold"
              >
                إلغاء الماسح
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Scanner Modal (For Course Code) */}
      {showOcrScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 p-6 rounded-lg space-y-6 text-right select-none animate-zoomIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-swiss-lavender" />
                <span>قارئ كود التفعيل بالـ OCR</span>
              </h3>
              <button
                type="button"
                onClick={stopOcrScanner}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {ocrError && (
              <div className="p-3 bg-red-950/20 border border-red-800 text-red-300 text-xs font-semibold rounded-md">
                {ocrError}
              </div>
            )}

            <div className="relative w-full aspect-video bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden flex items-center justify-center">
              <video ref={ocrVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              
              {/* Bounding Box Overlay */}
              <div className="absolute left-[20%] right-[20%] top-[37.5%] bottom-[37.5%] border-2 border-dashed border-swiss-lavender rounded pointer-events-none flex items-center justify-center bg-black/20">
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-laserLine absolute top-0"></div>
                <span className="text-[10px] text-zinc-300 font-bold bg-black/60 px-2.5 py-1 rounded tracking-wide">ضع الكود في هذا الإطار</span>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={captureAndExtractOcr}
                disabled={ocrLoading}
                className="flex-1 py-3 swiss-btn-lavender flex items-center justify-center gap-2 font-bold disabled:opacity-50"
              >
                {ocrLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري معالجة الكود...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-zinc-950" />
                    <span>التقاط وقراءة الكود</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={stopOcrScanner}
                className="px-6 py-3 swiss-btn-neutral text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
            
            <style>{`
              @keyframes laser {
                0% { top: 0%; }
                50% { top: 100%; }
                100% { top: 0%; }
              }
              .animate-laserLine {
                animation: laser 2s infinite linear;
                position: absolute;
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}
