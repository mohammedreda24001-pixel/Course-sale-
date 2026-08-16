'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  AlertCircle,
  FileSpreadsheet,
  CheckSquare,
  Square,
  History as HistoryIcon,
  Sliders,
  ArrowUp,
  ArrowDown,
  X,
  Calendar,
  Bookmark
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLegacyProvinceCode, IRAQ_PROVINCE_NAMES } from '@/modules/shipping/iraq-provinces';
import { prepareOrderForShipping } from '@/modules/shipping/prepare-order';

interface StatsColumn {
  field: string;
  header: string;
  enabled: boolean;
}

const DEFAULT_STATS_COLUMNS: StatsColumn[] = [
  { field: 'province', header: 'المحافظة', enabled: true },
  { field: 'studentName', header: 'اسم الطالب', enabled: true },
  { field: 'phone1', header: 'رقم الطالب', enabled: true },
  { field: 'ShipmentTrackingCode', header: 'باركود الشحنة', enabled: true },
  { field: 'basePrice', header: 'سعر الدورة', enabled: true },
  { field: 'deliveryFee', header: 'سعر التوصيل', enabled: true },
  { field: 'totalPrice', header: 'المبلغ مع التوصيل', enabled: true },
  { field: 'phone2', header: 'رقم بديل', enabled: true },
  { field: 'address', header: 'العنوان', enabled: true },
  { field: 'landmark', header: 'نقطة دالة', enabled: true },
  { field: 'StudentVaultCode_ID', header: 'الكود', enabled: true },
  { field: 'StudentVaultCode_Serial', header: 'سيريال كود', enabled: true },
  { field: 'notes', header: 'ملاحظة العامة', enabled: true },
  { field: 'internalNotes', header: 'ملاحظة داخلية', enabled: true },
  { field: 'createdAt', header: 'تاريخ تسجيل الطلب', enabled: true },
  { field: 'receiptNumber', header: 'رقم الوصل', enabled: true },
  { field: 'status', header: 'حالة الطلب', enabled: true }
];

interface Order {
  id: number;
  studentName: string;
  phone1: string;
  phone2: string;
  province: string;
  region?: string;
  address: string;
  landmark: string;
  packageSize?: string;
  totalPrice: number;
  basePrice: number;
  deliveryFee: number;
  courseTypeId: number | null;
  StudentVaultCode_ID: string;
  StudentVaultCode_Serial: string;
  createdAt: string;
  createdById: string;
  createdByUsername: string;
  piecesCount: number;
  hasReturn: string;
  goodsType: string;
  returnDescription: string;
  receiptNumber: string;
  ShipmentTrackingCode: string | null;
  notes: string;
  internalNotes: string;
  telegramUsername: string;
  statusId: number | null;
  waseet_tracking_number?: string | null;
  waseet_sticker_url?: string | null;
  waseet_sync_status?: 'pending' | 'synced' | 'failed';
  waseet_sync_error?: string;
  waseet_synced_at?: string | null;
}

interface User {
  id: string;
  username: string;
  role: 'admin' | 'agent';
}

const ITEMS_PER_PAGE = 10;

function normalizePhone(phone: string): string {
  const western = String(phone || '')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
    .trim();
  if (!western) return '';
  const compact = western.replace(/[\s\-().]/g, '');
  let normalized = compact;
  if (normalized.startsWith('+964')) normalized = '0' + normalized.slice(4);
  else if (normalized.startsWith('964')) normalized = '0' + normalized.slice(3);
  return /^07\d{9}$/.test(normalized) ? normalized : western;
}

function normalizeTelegramUsername(username: string): string {
  if (!username) return '';
  return username.trim().replace(/^@+/, '');
}


export default function OrdersHistoryPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [courseTypes, setCourseTypes] = useState<{ id: number; name: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  
  const [statsColumns, setStatsColumns] = useState<StatsColumn[]>([]);

  // Statistics & Date Range Picker State
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsStartDate, setStatsStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [statsEndDate, setStatsEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [exportingStats, setExportingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [includeDailySummary, setIncludeDailySummary] = useState(false);

  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Order>>({});

  // Modal detail state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Vault Code Masking State
  const [revealedCodeOrderId, setRevealedCodeOrderId] = useState<number | null>(null);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('.code-mask-span')) {
        return;
      }
      setRevealedCodeOrderId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('stats_export_preset');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as StatsColumn[];
        // Auto-merge new default columns if they are not present in the user's saved preset
        const merged = [...parsed];
        DEFAULT_STATS_COLUMNS.forEach(defCol => {
          if (!merged.some(c => c.field === defCol.field)) {
            merged.push(defCol);
          }
        });
        setStatsColumns(merged);
      } catch (e) {
        setStatsColumns(DEFAULT_STATS_COLUMNS);
      }
    } else {
      setStatsColumns(DEFAULT_STATS_COLUMNS);
    }
  }, []);

  const handleToggleStatsColumn = (index: number) => {
    const updated = [...statsColumns];
    updated[index].enabled = !updated[index].enabled;
    setStatsColumns(updated);
    localStorage.setItem('stats_export_preset', JSON.stringify(updated));
  };

  const handleMoveStatsColumn = (index: number, direction: 'up' | 'down') => {
    const updated = [...statsColumns];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setStatsColumns(updated);
    localStorage.setItem('stats_export_preset', JSON.stringify(updated));
  };

  const handleExportPrime = () => {
    const exportTargets = orders.filter(o => selectedOrderIds.includes(o.id));
    if (exportTargets.length === 0) {
      alert('الرجاء تحديد طلب واحد على الأقل للتصدير');
      return;
    }

    const invalidProvinceOrder = exportTargets.find(o => !getLegacyProvinceCode(o.province));
    if (invalidProvinceOrder) {
      alert(`لا يمكن تصدير الطلب ${invalidProvinceOrder.receiptNumber || invalidProvinceOrder.id}: المحافظة غير معروفة. صحح المحافظة أولاً.`);
      return;
    }

    // Fixed 13 columns exactly mirroring the delivery company import layout:
    const headers = [
      'ملاحظات',
      'عدد القطع أجباري',
      'يحتوي على ارجاع بضاعة؟',
      'هاتف المستلم أجباري 11 رقم',
      'تفاصيل العنوان أجباري',
      'شفرة المحافظة أجباري',
      'اسم المستلم',
      'المبلغ عراقي كامل بالالاف ,في حال عدم توفره سيعتبر 0',
      'رقم الوصل في حال عدم وجود رقم وصل سيتم توليده من النظام',
      'كود الشحنة',
      'هاتف المستلم 2',
      'نوع البضاعة',
      'وصف البضاعة المسترجعة او المستبدلة'
    ];

    const rows = exportTargets.map(o => [
      o.notes || '', // Public notes only, internalNotes is strictly excluded
      o.piecesCount || 1,
      o.hasReturn || 'لا',
      normalizePhone(o.phone1), // Normalized phone numbers
      `${o.address}${o.landmark ? ' - دالة: ' + o.landmark : ''}`,
      getLegacyProvinceCode(o.province)!,
      o.studentName,
      (o.totalPrice || 0) * 1000, // Multiplied price
      o.receiptNumber || o.id.toString(),
      '', // كود الشحنة (Shipment tracking code is empty string for export)
      o.phone2 ? normalizePhone(o.phone2) : '',
      o.goodsType || 'كورس تعليمي',
      o.returnDescription || ''
    ]);

    const worksheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set widths
    worksheet['!cols'] = [
      { wch: 25 }, // ملاحظات
      { wch: 15 }, // عدد القطع أجباري
      { wch: 20 }, // يحتوي على ارجاع بضاعة؟
      { wch: 25 }, // هاتف المستلم أجباري 11 رقم
      { wch: 35 }, // تفاصيل العنوان أجباري
      { wch: 20 }, // شفرة المحافظة أجباري
      { wch: 25 }, // اسم المستلم
      { wch: 45 }, // المبلغ عراقي كامل بالالاف
      { wch: 45 }, // رقم الوصل
      { wch: 15 }, // كود الشحنة
      { wch: 20 }, // هاتف المستلم 2
      { wch: 20 }, // نوع البضاعة
      { wch: 30 }  // وصف البضاعة المسترجعة او المستبدلة
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلبات المحددة");
    
    XLSX.writeFile(workbook, `orders_prime_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };


  const handleExportPDF = async () => {
    if (!statsStartDate || !statsEndDate) {
      setStatsError('الرجاء اختيار تاريخ البدء والانتهاء');
      return;
    }
    
    setStatsError('');
    setExportingStats(true);
    try {
      const res = await fetch(`/api/orders/statistics?startDate=${statsStartDate}&endDate=${statsEndDate}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشل في جلب البيانات');
      }
      
      const statsOrders: Order[] = await res.json();
      if (statsOrders.length === 0) {
        setStatsError('لا توجد طلبات في هذا النطاق الزمني المحدد');
        setExportingStats(false);
        return;
      }

      // Calculate summaries
      const totalCount = statsOrders.length;
      const totalRevenue = statsOrders.reduce((sum, o) => sum + (o.totalPrice || 0) * 1000, 0);
      
      // Course breakdown
      const courseBreakdown: { [key: string]: number } = {};
      statsOrders.forEach(o => {
        const cName = courseTypes.find(ct => ct.id === o.courseTypeId)?.name || 'دورة الأحياء';
        courseBreakdown[cName] = (courseBreakdown[cName] || 0) + 1;
      });

      // Province breakdown
      const provinceBreakdown: { [key: string]: number } = {};
      statsOrders.forEach(o => {
        provinceBreakdown[o.province] = (provinceBreakdown[o.province] || 0) + 1;
      });

      // Group by YYYY-MM-DD for daily summary
      const dailyStats: { [date: string]: number } = {};
      statsOrders.forEach(o => {
        if (o.createdAt) {
          const dateKey = new Date(o.createdAt).toISOString().split('T')[0];
          dailyStats[dateKey] = (dailyStats[dateKey] || 0) + 1;
        }
      });
      const sortedDailyStats = Object.entries(dailyStats).sort((a, b) => a[0].localeCompare(b[0]));

      const activeColumns = statsColumns.filter(c => c.enabled);

      // EXCEL EXPORT ROUTE
      if (exportFormat === 'excel') {
        // Sheet 1: Orders Details
        const headers = activeColumns.map(col => col.header);
        const rows = statsOrders.map(o => {
          return activeColumns.map(col => {
            switch (col.field) {
              case 'province': return o.province || '';
              case 'studentName': return o.studentName || '';
              case 'phone1': return normalizePhone(o.phone1 || '');
              case 'ShipmentTrackingCode': return o.ShipmentTrackingCode || '';
              case 'basePrice': return (o.basePrice || 0) * 1000;
              case 'deliveryFee': return o.deliveryFee === 0 ? 'مجانًا' : (o.deliveryFee || 0) * 1000;
              case 'totalPrice': return (o.totalPrice || 0) * 1000;
              case 'phone2': return o.phone2 ? normalizePhone(o.phone2) : '';
              case 'address': return o.address || '';
              case 'landmark': return o.landmark || '';
              case 'StudentVaultCode_ID': return o.StudentVaultCode_ID || '';
              case 'StudentVaultCode_Serial': return o.StudentVaultCode_Serial || '';
              case 'notes': return o.notes || '';
              case 'internalNotes': return o.internalNotes || '';
              case 'createdAt': return o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-IQ') : '';
              case 'receiptNumber': return o.receiptNumber || '';
              case 'status': return statuses.find(s => s.id === o.statusId)?.name || 'جاهز للتسليم';
              default: return '';
            }
          });
        });

        const mainSheetData = [headers, ...rows];
        const mainWorksheet = XLSX.utils.aoa_to_sheet(mainSheetData);

        // Sheet 2: Summary Metrics
        const summaryRows = [
          ['تقرير إحصائيات المبيعات والطلبات', ''],
          ['الفترة من', `${new Date(statsStartDate).toLocaleDateString('ar-IQ')} إلى ${new Date(statsEndDate).toLocaleDateString('ar-IQ')}`],
          ['تاريخ إصدار التقرير', new Date().toLocaleDateString('ar-IQ')],
          [],
          ['المؤشر الإجمالي', 'القيمة'],
          ['إجمالي الطلبات', totalCount],
          ['إجمالي الإيرادات (د.ع)', totalRevenue],
          [],
          ['توزيع الكورسات الأكثر مبيعاً', ''],
          ['اسم الكورس', 'عدد المبيعات']
        ];
        
        Object.entries(courseBreakdown).forEach(([name, count]) => {
          summaryRows.push([name, count]);
        });
        
        summaryRows.push([]);
        summaryRows.push(['التوزيع الجغرافي للطلبات (المحافظات)', '']);
        summaryRows.push(['المحافظة', 'عدد الطلبات', 'النسبة المئوية']);
        
        Object.entries(provinceBreakdown).forEach(([prov, count]) => {
          summaryRows.push([prov, count, `${((count / totalCount) * 100).toFixed(1)}%`]);
        });

        const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryRows);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, mainWorksheet, 'تفاصيل الطلبات');
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'الملخص والإحصائيات');

        // Optional Sheet 3: Daily Summary
        if (includeDailySummary) {
          const dailyHeaders = ['التاريخ', 'عدد الطلبات'];
          const dailyRows = sortedDailyStats.map(([dateKey, count]) => [
            new Date(dateKey).toLocaleDateString('ar-IQ'),
            count
          ]);
          const dailyWorksheet = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]);
          XLSX.utils.book_append_sheet(workbook, dailyWorksheet, 'الإحصائيات اليومية');
        }

        XLSX.writeFile(workbook, `orders_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
        setShowStatsModal(false);
        return;
      }

      // PDF EXPORT ROUTE (Default)
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('الرجاء السماح بالنوافذ المنبثقة لتوليد ملف PDF');
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير المبيعات والطلبات</title>
          <style>
            @font-face {
              font-family: 'Thmanyah';
              src: url('https://framerusercontent.com/assets/x6EBzvXf1Fi35XhsRoHxePDVo.woff2') format('woff2');
              font-weight: 400;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: 'Thmanyah';
              src: url('https://framerusercontent.com/assets/LZvgFRUsP7pGWYj3tKxMUrKuhSY.woff2') format('woff2');
              font-weight: 700;
              font-style: normal;
              font-display: swap;
            }
            
            body {
              font-family: 'Thmanyah', sans-serif;
              color: #000;
              background-color: #fff;
              margin: 40px;
              padding: 0;
              line-height: 1.6;
              font-size: 11px;
            }

            h1 {
              font-size: 24px;
              font-weight: 800;
              margin: 0 0 10px 0;
              letter-spacing: -0.5px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }

            .subtitle {
              font-size: 12px;
              color: #555;
              margin-bottom: 30px;
              font-weight: 600;
            }

            .grid-stats {
              display: grid;
              grid-template-cols: repeat(4, 1fr);
              gap: 20px;
              margin-bottom: 40px;
            }

            .stat-card {
              border: 1px solid #000;
              padding: 15px;
              background: #fff;
            }

            .stat-card .label {
              font-size: 9px;
              text-transform: uppercase;
              color: #666;
              font-weight: bold;
              margin-bottom: 5px;
            }

            .stat-card .value {
              font-size: 18px;
              font-weight: 800;
            }

            .section-title {
              font-size: 14px;
              font-weight: 800;
              margin: 30px 0 15px 0;
              text-transform: uppercase;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }

            .breakdown-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }

            .breakdown-table th, .breakdown-table td {
              border: 1px solid #ddd;
              padding: 8px 12px;
              text-align: right;
            }

            .breakdown-table th {
              background-color: #f5f5f5;
              font-weight: bold;
            }

            .main-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              page-break-inside: auto;
            }

            .main-table tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }

            .main-table th, .main-table td {
              border: 1px solid #000;
              padding: 10px;
              text-align: right;
              font-size: 10px;
            }

            .main-table th {
              background-color: #000;
              color: #fff;
              font-weight: 800;
              text-transform: uppercase;
            }

            .text-mono {
              font-family: 'Outfit', monospace;
            }

            .footer-info {
              margin-top: 50px;
              font-size: 9px;
              color: #888;
              text-align: center;
              border-top: 1px dashed #ccc;
              padding-top: 15px;
              page-break-inside: avoid;
            }

            @media print {
              body {
                margin: 20px;
              }
              button {
                display: none;
              }
              @page {
                size: landscape;
                margin: 10mm;
              }
            }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div>
              <h1>تقرير المبيعات والطلبات</h1>
              <div class="subtitle">الفترة من ${new Date(statsStartDate).toLocaleDateString('ar-IQ')} إلى ${new Date(statsEndDate).toLocaleDateString('ar-IQ')}</div>
            </div>
            <div style="text-align: left; font-size: 10px; font-weight: bold;">
               تاريخ إصدار التقرير: ${new Date().toLocaleDateString('ar-IQ')}
            </div>
          </div>

          <div class="grid-stats">
            <div class="stat-card">
              <div class="label">إجمالي الطلبات</div>
              <div class="value">${totalCount}</div>
            </div>
            <div class="stat-card">
              <div class="label">إجمالي الإيرادات</div>
              <div class="value">${totalRevenue.toLocaleString()} د.ع</div>
            </div>
            <div class="stat-card" style="grid-column: span 2;">
              <div class="label">توزيع الكورسات الأكثر مبيعاً</div>
              <div class="value" style="font-size: 11px; font-weight: 600; margin-top: 5px; line-height: 1.4;">
                ${Object.entries(courseBreakdown).map(([name, count]) => `${name}: ${count}`).join(' | ')}
              </div>
            </div>
          </div>

          <div class="section-title">التفاصيل الجغرافية (حسب المحافظات)</div>
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>المحافظة</th>
                <th>عدد الطلبات</th>
                <th>النسبة المئوية</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(provinceBreakdown).map(([prov, count]) => `
                <tr>
                  <td><strong>${prov}</strong></td>
                  <td class="text-mono">${count}</td>
                  <td class="text-mono">${((count / totalCount) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${includeDailySummary ? `
            <div class="section-title">إحصائيات الطلبات اليومية (حسب التاريخ)</div>
            <table class="breakdown-table" style="max-width: 400px; margin-bottom: 35px;">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>عدد الطلبات</th>
                </tr>
              </thead>
              <tbody>
                ${sortedDailyStats.map(([dateKey, count]) => `
                  <tr>
                    <td><strong>${new Date(dateKey).toLocaleDateString('ar-IQ')}</strong></td>
                    <td class="text-mono">${count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div class="section-title">جدول التدقيق والتفاصيل الكاملة</div>
          <table class="main-table">
            <thead>
              <tr>
                ${activeColumns.map(col => `<th>${col.header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${statsOrders.map(o => `
                <tr>
                  ${activeColumns.map(col => {
                    let val = '';
                    switch (col.field) {
                      case 'province': val = o.province || ''; break;
                      case 'studentName': val = `<strong>${o.studentName || ''}</strong>`; break;
                      case 'phone1': val = `<span class="text-mono">${normalizePhone(o.phone1 || '')}</span>`; break;
                      case 'ShipmentTrackingCode': val = `<span class="text-mono">${o.ShipmentTrackingCode || ''}</span>`; break;
                      case 'basePrice': val = `<span class="text-mono">${((o.basePrice || 0) * 1000).toLocaleString()}</span>`; break;
                      case 'deliveryFee': val = `<span class="text-mono">${o.deliveryFee === 0 ? 'مجانًا' : ((o.deliveryFee || 0) * 1000).toLocaleString()}</span>`; break;
                      case 'totalPrice': val = `<span class="text-mono">${((o.totalPrice || 0) * 1000).toLocaleString()}</span>`; break;
                      case 'phone2': val = `<span class="text-mono">${o.phone2 ? normalizePhone(o.phone2) : ''}</span>`; break;
                      case 'address': val = o.address || ''; break;
                      case 'landmark': val = o.landmark || ''; break;
                      case 'StudentVaultCode_ID': val = `<span class="text-mono">${o.StudentVaultCode_ID || ''}</span>`; break;
                      case 'StudentVaultCode_Serial': val = `<span class="text-mono">${o.StudentVaultCode_Serial || ''}</span>`; break;
                      case 'notes': val = o.notes || ''; break;
                      case 'internalNotes': val = o.internalNotes || ''; break;
                      case 'createdAt': val = o.createdAt ? `<span class="text-mono">${new Date(o.createdAt).toLocaleDateString('ar-IQ')}</span>` : ''; break;
                      case 'receiptNumber': val = `<span class="text-mono">${o.receiptNumber || ''}</span>`; break;
                      case 'status': val = statuses.find(s => s.id === o.statusId)?.name || 'جاهز للتسليم'; break;
                      default: val = '';
                    }
                    return `<td>${val}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-info">
            نظام إدارة المبيعات وحجوزات الكودات - تصميم سويسري بسيط (Swiss Minimalism)
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setShowStatsModal(false);
    } catch (err: any) {
      setStatsError(err.message || 'حدث خطأ أثناء تحميل الإحصائيات');
    } finally {
      setExportingStats(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, statusId: number) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, statusId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث حالة الطلب');
      }

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, statusId } : o));
      setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, statusId } : prev);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleStartEdit = () => {
    if (!selectedOrder) return;
    setEditFormData({ ...selectedOrder });
    setIsEditingOrder(true);
  };

  const handleCancelEdit = () => {
    setIsEditingOrder(false);
    setEditFormData({});
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
    setIsEditingOrder(false);
    setEditFormData({});
  };

  const handleSaveOrderChanges = async () => {
    if (!selectedOrder) return;
    setError('');
    try {
      const updates = {
        studentName: editFormData.studentName,
        phone1: editFormData.phone1,
        phone2: editFormData.phone2,
        province: editFormData.province,
        region: editFormData.region,
        address: editFormData.address,
        landmark: editFormData.landmark,
        packageSize: editFormData.packageSize,
        piecesCount: editFormData.piecesCount,
        telegramUsername: editFormData.telegramUsername?.trim(),
        basePrice: editFormData.basePrice,
        deliveryFee: editFormData.deliveryFee,
        statusId: editFormData.statusId,
        notes: editFormData.notes,
        internalNotes: editFormData.internalNotes
      };

      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, updates }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل في حفظ التعديلات');
      }

      // Update locally
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...data.order } : o));
      setSelectedOrder(data.order);
      setIsEditingOrder(false);
      setEditFormData({});
    } catch (err: any) {
      alert(err.message || 'حدث خطأ في الاتصال بالخادم');
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, ordersRes, courseTypesRes, statusesRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/orders'),
          fetch('/api/course-types'),
          fetch('/api/statuses')
        ]);
        
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData.user);
        }
        
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData);
        } else {
          setError('فشل في جلب قائمة الطلبات');
        }

        if (courseTypesRes.ok) {
          const ctData = await courseTypesRes.json();
          setCourseTypes(ctData);
        }

        if (statusesRes.ok) {
          const sData = await statusesRes.json();
          setStatuses(sData);
        }
      } catch (err) {
        setError('حدث خطأ في الاتصال بالخادم');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleDeleteOrder = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟ سيتم تحرير الكود المرفق وإعادته للمخزن تلقائياً.')) {
      return;
    }

    try {
      const res = await fetch(`/api/orders?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف الطلب');
      }

      setOrders(prev => prev.filter(o => o.id !== id));
      setSelectedOrderIds(prev => prev.filter(oid => oid !== id));
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleSelectAll = (filteredList: Order[]) => {
    const visibleIds = filteredList.map(o => o.id);
    const allSelected = visibleIds.every(id => selectedOrderIds.includes(id));

    if (allSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => {
        const union = new Set([...prev, ...visibleIds]);
        return Array.from(union);
      });
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch = 
      o.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.phone1.includes(searchQuery) ||
      o.phone2.includes(searchQuery) ||
      (o.StudentVaultCode_ID || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.receiptNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toString().includes(searchQuery);

    const matchProvince = selectedProvince === '' || o.province === selectedProvince;
    const matchStatus = selectedStatusFilter === '' || o.statusId?.toString() === selectedStatusFilter;
    const matchCourse = selectedCourseFilter === '' || o.courseTypeId?.toString() === selectedCourseFilter;

    return matchSearch && matchProvince && matchStatus && matchCourse;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortOrder === 'none') return 0;
    const nameA = a.studentName.toLowerCase();
    const nameB = b.studentName.toLowerCase();
    if (sortOrder === 'asc') {
      return nameA.localeCompare(nameB, 'ar');
    } else {
      return nameB.localeCompare(nameA, 'ar');
    }
  });

  const uniqueProvincesInOrders = Array.from(new Set(orders.map(o => o.province))).filter(Boolean);

  const totalPages = Math.ceil(sortedOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = sortedOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedProvince, selectedStatusFilter, selectedCourseFilter, sortOrder]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-swiss-lavender" />
        <span className="text-sm font-semibold">جاري تحميل سجل الطلبات...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none px-4 py-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <HistoryIcon className="w-6 h-6 text-swiss-lavender" />
            <span>الطلبات</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            إدارة ومتابعة طلبات الطلاب، وتحديث حالات التوصيل، وتصدير شحنات التوصيل برايم.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 font-semibold">
          <button
            onClick={handleExportPrime}
            disabled={selectedOrderIds.length === 0}
            className="px-5 py-2.5 swiss-btn-lavender flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer font-bold text-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-zinc-950" />
            <span>استخراج اكسل برايم ({selectedOrderIds.length})</span>
          </button>

          <button
            onClick={() => setShowStatsModal(true)}
            className="px-5 py-2.5 swiss-btn-neutral flex items-center justify-center gap-2 cursor-pointer font-bold text-xs"
          >
            <Calendar className="w-4 h-4 text-swiss-lavender" />
            <span>استخراج احصائيات</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800 text-red-300 text-xs font-bold rounded-lg">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 bg-zinc-950/20 p-4 border border-zinc-800 rounded-lg">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            className="w-full pr-10 pl-4 py-2.5 swiss-input text-xs font-semibold"
            placeholder="البحث باسم المستلم، الهاتف، الكود، رقم الوصل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Province Filter */}
        <div className="md:col-span-2 relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
            <MapPin className="w-4 h-4" />
          </div>
          <select
            className="w-full pr-10 pl-4 py-2.5 swiss-input text-xs font-semibold appearance-none bg-[#0c0c0e]"
            value={selectedProvince}
            onChange={(e) => setSelectedProvince(e.target.value)}
          >
            <option value="">كل المحافظات</option>
            {uniqueProvincesInOrders.map(prov => (
              <option key={prov} value={prov}>{prov}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="md:col-span-2 relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
            <Sliders className="w-4 h-4 text-zinc-500" />
          </div>
          <select
            className="w-full pr-10 pl-4 py-2.5 swiss-input text-xs font-semibold appearance-none bg-[#0c0c0e]"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
          >
            <option value="">كل الحالات</option>
            {statuses.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Course Filter */}
        <div className="md:col-span-2 relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
            <Bookmark className="w-4 h-4 text-zinc-500" />
          </div>
          <select
            className="w-full pr-10 pl-4 py-2.5 swiss-input text-xs font-semibold appearance-none bg-[#0c0c0e]"
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
          >
            <option value="">كل الدورات</option>
            {courseTypes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Sorting Toggles */}
        <div className="md:col-span-2 flex items-center justify-end gap-2">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider select-none">الاسم:</span>
          <button
            type="button"
            onClick={() => {
              if (sortOrder === 'none') setSortOrder('asc');
              else if (sortOrder === 'asc') setSortOrder('desc');
              else setSortOrder('none');
            }}
            className={`px-3 py-2 text-xs font-bold rounded border cursor-pointer select-none transition-all flex items-center gap-1.5 ${
              sortOrder !== 'none'
                ? 'bg-swiss-lavender/10 text-swiss-lavender border-swiss-lavender/25'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {sortOrder === 'none' && <span>تلقائي</span>}
            {sortOrder === 'asc' && (
              <>
                <ArrowUp className="w-3.5 h-3.5" />
                <span>تصاعدي</span>
              </>
            )}
            {sortOrder === 'desc' && (
              <>
                <ArrowDown className="w-3.5 h-3.5" />
                <span>تنازلي</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Orders Table Panel */}
      <div className="swiss-panel rounded-lg overflow-hidden border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-900/40 border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider select-none">
                <th className="py-4 px-5 text-center w-12 border-l border-zinc-800/60">
                  <button 
                    onClick={() => handleSelectAll(sortedOrders)}
                    className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {sortedOrders.length > 0 && sortedOrders.every(o => selectedOrderIds.includes(o.id)) ? (
                      <CheckSquare className="w-5 h-5 text-swiss-lavender" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="py-4 px-4 text-center border-l border-zinc-800/60">رقم الوصل</th>
                <th className="py-4 px-4 border-l border-zinc-800/60">اسم المستلم ومعلومات الاتصال</th>
                <th className="py-4 px-4 text-center border-l border-zinc-800/60">المحافظة وشفرتها</th>
                <th className="py-4 px-4 border-l border-zinc-800/60">العنوان وتفاصيل الشحنة</th>
                <th className="py-4 px-4 text-center border-l border-zinc-800/60">كود تفعيل دورة الطالب</th>
                <th className="py-4 px-4 text-center border-l border-zinc-800/60">حالة الطلب</th>
                <th className="py-4 px-4 text-center border-l border-zinc-800/60">سعر الدورة</th>
                <th className="py-4 px-4 text-center border-l border-zinc-800/60">سعر التوصيل</th>
                <th className="py-4 px-4 text-center border-l border-zinc-800/60">المبلغ الكلي</th>
                <th className="py-4 px-4 text-center border-l border-zinc-800/60">الوكيل والتاريخ</th>
                {currentUser?.role === 'admin' && <th className="py-4 px-4 text-center w-16">إجراء</th>}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-zinc-800/60 text-xs font-semibold">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={currentUser?.role === 'admin' ? 12 : 11} className="py-12 text-center text-zinc-500 font-semibold">
                    لا توجد أي طلبات مطابقة لمعايير البحث.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  return (
                    <tr 
                      key={order.id} 
                      className={`transition-colors duration-100 ${
                        isSelected ? 'bg-swiss-lavender/5 text-white' : 'hover:bg-zinc-900/10'
                      }`}
                    >
                      <td className="py-4 px-5 text-center border-l border-zinc-800/40">
                        <button 
                          onClick={() => handleSelectRow(order.id)}
                          className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-swiss-lavender" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-center font-mono border-l border-zinc-800/40">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="font-bold text-swiss-lavender hover:text-white bg-zinc-950 border border-zinc-800 hover:border-swiss-lavender px-3 py-1.5 rounded font-mono text-[10px] cursor-pointer transition-all hover:bg-zinc-900"
                        >
                          {order.receiptNumber || order.id}
                        </button>
                      </td>
                      <td className="py-4 px-4 border-l border-zinc-800/40">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="font-bold text-zinc-100 text-sm hover:text-swiss-lavender transition-colors cursor-pointer text-right block"
                        >
                          {order.studentName}
                        </button>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{order.phone1} {order.phone2 && `/ ${order.phone2}`}</div>
                      </td>
                      <td className="py-4 px-4 text-center border-l border-zinc-800/40">
                        <div className="text-zinc-300 font-bold">{order.province}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 text-[9px] bg-zinc-900 border border-zinc-800 text-swiss-lavender font-mono rounded">
                          {getLegacyProvinceCode(order.province) || 'غير معروف'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-zinc-400 border-l border-zinc-800/40">
                        <div>{order.address}</div>
                        {order.landmark && <div className="text-zinc-500 text-[10px] mt-0.5">الدالة: {order.landmark}</div>}
                        <div className="text-swiss-lavender text-[9px] font-bold mt-1">
                          القطع: {order.piecesCount || 1} | نوع البضاعة: {order.goodsType || 'كورس تعليمي'}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center border-l border-zinc-800/40">
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setRevealedCodeOrderId(prev => prev === order.id ? null : order.id);
                          }}
                          className="code-mask-span font-mono bg-zinc-950 border border-zinc-800 text-swiss-lavender px-2.5 py-1 text-xs font-semibold rounded cursor-pointer select-none hover:border-swiss-lavender/50 transition-colors"
                          title={revealedCodeOrderId === order.id ? "انقر لإخفاء الكود" : "انقر لإظهار الكود"}
                        >
                          {revealedCodeOrderId === order.id ? order.StudentVaultCode_ID : "••••••••"}
                        </span>
                        <div className="text-[9px] text-zinc-500 font-mono mt-1.5">SN: {order.StudentVaultCode_Serial}</div>
                      </td>
                      <td className="py-4 px-4 text-center border-l border-zinc-800/40 w-36">
                        <select
                          value={order.statusId || 1}
                          onChange={(e) => handleUpdateOrderStatus(order.id, Number(e.target.value))}
                          className={`w-full px-2.5 py-1 text-[10px] font-bold bg-[#0c0c0e] border rounded outline-none cursor-pointer text-center ${
                            order.statusId === 4
                              ? 'text-red-400 border-red-500/20 focus:border-red-500/50'
                              : order.statusId === 2
                              ? 'text-emerald-400 border-emerald-500/20 focus:border-emerald-500/50'
                              : order.statusId === 3
                              ? 'text-blue-400 border-blue-500/20 focus:border-blue-500/50'
                              : 'text-zinc-300 border-zinc-800 focus:border-swiss-lavender'
                          }`}
                        >
                          {statuses.map(s => (
                            <option key={s.id} value={s.id} className="bg-zinc-900 text-zinc-300 text-right">
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 px-4 text-zinc-200 text-center font-mono border-l border-zinc-800/40">
                        {order.basePrice ? (order.basePrice * 1000).toLocaleString() : 0} د.ع
                      </td>
                      <td className="py-4 px-4 text-center border-l border-zinc-800/40">
                        {order.deliveryFee === 0 ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] bg-blue-950/40 border border-blue-800/60 text-blue-300 font-bold rounded">
                            مجانًا
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 font-mono font-bold rounded">
                            {(order.deliveryFee * 1000).toLocaleString()} د.ع
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-zinc-100 text-center font-mono border-l border-zinc-800/40 font-bold">
                        {order.totalPrice ? (order.totalPrice * 1000).toLocaleString() : 0} د.ع
                      </td>
                      <td className="py-4 px-4 text-zinc-400 text-center border-l border-zinc-800/40">
                        <div>{order.createdByUsername}</div>
                        <div className="text-[9px] text-zinc-500 font-mono mt-0.5">{new Date(order.createdAt).toLocaleDateString('ar-IQ')}</div>
                      </td>
                      
                      {currentUser?.role === 'admin' && (
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-2 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="حذف الطلب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination controls */}
        {filteredOrders.length > 0 && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-zinc-400">
              الصفحة {currentPage} من {totalPages} ({filteredOrders.length} طلب)
            </span>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 swiss-btn-neutral disabled:opacity-35 disabled:pointer-events-none"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                      currentPage === idx + 1 
                        ? 'bg-swiss-lavender text-zinc-950 font-bold' 
                        : 'bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 swiss-btn-neutral disabled:opacity-35 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal (Swiss Minimalist Dialog) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 p-6 rounded-lg animate-zoomIn space-y-6 text-right select-none max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-swiss-lavender" />
                <span>{isEditingOrder ? 'تعديل تفاصيل الطلب' : 'تفاصيل حجز الطالب'} (وصل #{selectedOrder.receiptNumber})</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              {isEditingOrder ? (
                <>
                  {/* Student Name */}
                  <div className="col-span-2 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">اسم الطالب</span>
                    <input
                      type="text"
                      value={editFormData.studentName || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, studentName: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender"
                    />
                  </div>

                  {/* Province */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">المحافظة</span>
                    <select
                      value={editFormData.province || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, province: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender"
                    >
                      <option value="">اختر المحافظة</option>
                      {IRAQ_PROVINCE_NAMES.map(province => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                  </div>

                  {/* Shipping Region */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">المنطقة للوسيط</span>
                    <input
                      type="text"
                      value={editFormData.region || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, region: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender"
                      placeholder="بدون تخمين"
                    />
                  </div>

                  {/* Phone 1 */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">رقم الهاتف الأساسي</span>
                    <input
                      type="text"
                      value={editFormData.phone1 || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, phone1: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender text-left font-mono"
                      dir="ltr"
                    />
                  </div>

                  {/* Phone 2 */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">رقم الهاتف البديل</span>
                    <input
                      type="text"
                      value={editFormData.phone2 || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, phone2: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender text-left font-mono"
                      dir="ltr"
                    />
                  </div>

                  {/* Telegram */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">معرف التلكرام</span>
                    <input
                      type="text"
                      value={editFormData.telegramUsername || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, telegramUsername: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender text-left font-mono"
                      dir="ltr"
                      placeholder="username"
                    />
                  </div>

                  {/* Base Price */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">سعر الدورة بالآلاف (مثال: 250)</span>
                    <input
                      type="number"
                      value={editFormData.basePrice !== undefined ? editFormData.basePrice : 250}
                      onChange={(e) => {
                        const bp = Number(e.target.value);
                        setEditFormData(prev => ({
                          ...prev,
                          basePrice: bp,
                          totalPrice: bp + (prev.deliveryFee || 0)
                        }));
                      }}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender text-left font-mono"
                      dir="ltr"
                    />
                  </div>

                  {/* Delivery Fee */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">سعر التوصيل بالآلاف (مثال: 5)</span>
                    <input
                      type="number"
                      value={editFormData.deliveryFee !== undefined ? editFormData.deliveryFee : 5}
                      onChange={(e) => {
                        const df = Number(e.target.value);
                        setEditFormData(prev => ({
                          ...prev,
                          deliveryFee: df,
                          totalPrice: (prev.basePrice || 0) + df
                        }));
                      }}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender text-left font-mono"
                      dir="ltr"
                    />
                  </div>

                  {/* Pieces Count */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">عدد القطع</span>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.piecesCount ?? 1}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, piecesCount: Number(e.target.value) }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender text-left font-mono"
                      dir="ltr"
                    />
                  </div>

                  {/* Package Size */}
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">حجم الطرد للوسيط</span>
                    <input
                      type="text"
                      value={editFormData.packageSize || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, packageSize: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender"
                      placeholder="اتركه فارغاً إذا غير مؤكد"
                    />
                  </div>

                  {/* Status Selector */}
                  <div className="col-span-2 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">حالة الطلب</span>
                    <select
                      value={editFormData.statusId || 1}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, statusId: Number(e.target.value) }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender cursor-pointer"
                    >
                      {statuses.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Address */}
                  <div className="col-span-2 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">العنوان بالتفصيل</span>
                    <textarea
                      value={editFormData.address || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender h-16 resize-none"
                    />
                  </div>

                  {/* Landmark */}
                  <div className="col-span-2 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">أقرب نقطة دالة</span>
                    <input
                      type="text"
                      value={editFormData.landmark || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, landmark: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender"
                    />
                  </div>

                  {/* General Notes */}
                  <div className="col-span-2 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded space-y-1">
                    <span className="text-[10px] text-zinc-500 block">ملاحظة الطلب العامة</span>
                    <textarea
                      value={editFormData.notes || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender h-16 resize-none"
                    />
                  </div>

                  {/* Internal Notes */}
                  <div className="col-span-2 p-3 bg-swiss-lavender/5 border border-swiss-lavender/20 rounded space-y-1">
                    <span className="text-[10px] text-swiss-lavender block">ملاحظات داخلية</span>
                    <textarea
                      value={editFormData.internalNotes || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, internalNotes: e.target.value }))}
                      className="w-full px-3 py-1.5 swiss-input text-xs font-semibold bg-zinc-950 text-zinc-200 border border-zinc-800 rounded outline-none focus:border-swiss-lavender h-16 resize-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">اسم الطالب</span>
                    <span className="text-zinc-200 text-sm font-bold">{selectedOrder.studentName}</span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">نوع الدورة</span>
                    <span className="text-swiss-lavender font-bold text-sm">
                      {courseTypes.find(c => c.id === selectedOrder.courseTypeId)?.name || 'دورة الأحياء'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">رقم الهاتف الأساسي</span>
                    <span className="text-zinc-200 font-mono select-all text-sm">{selectedOrder.phone1}</span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">رقم الهاتف البديل</span>
                    <span className="text-zinc-200 font-mono select-all text-sm">{selectedOrder.phone2 || 'لا يوجد'}</span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">المحافظة</span>
                    <span className="text-zinc-200 text-sm font-bold">{selectedOrder.province}</span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">المنطقة للوسيط</span>
                    <span className={selectedOrder.region ? 'text-zinc-200 text-sm font-bold' : 'text-amber-400 text-sm font-bold'}>
                      {selectedOrder.region || 'غير محددة'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">سعر الدورة</span>
                    <span className="text-zinc-200 font-mono text-sm font-bold">{(selectedOrder.basePrice * 1000).toLocaleString()} د.ع</span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">سعر التوصيل</span>
                    <span className="text-zinc-200 font-mono text-sm font-bold">
                      {selectedOrder.deliveryFee === 0 ? 'مجانًا' : `${(selectedOrder.deliveryFee * 1000).toLocaleString()} د.ع`}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">المبلغ الإجمالي</span>
                    <span className="text-emerald-400 font-mono text-sm font-bold">{(selectedOrder.totalPrice * 1000).toLocaleString()} د.ع</span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">معرف التلكرام</span>
                    {selectedOrder.telegramUsername ? (
                      <a
                        href={`https://t.me/${normalizeTelegramUsername(selectedOrder.telegramUsername)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-swiss-lavender font-bold hover:underline text-sm font-mono"
                      >
                        {selectedOrder.telegramUsername}
                      </a>
                    ) : (
                      <span className="text-zinc-500 text-sm">—</span>
                    )}
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">عدد القطع</span>
                    <span className="text-zinc-200 text-sm font-bold">{selectedOrder.piecesCount || 1}</span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">حجم الطرد للوسيط</span>
                    <span className={selectedOrder.packageSize ? 'text-zinc-200 text-sm font-bold' : 'text-amber-400 text-sm font-bold'}>
                      {selectedOrder.packageSize || 'غير محدد'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">جاهزية الشحن</span>
                    {(() => {
                      const readiness = prepareOrderForShipping(selectedOrder);
                      return readiness.ready ? (
                        <span className="text-emerald-400 text-sm font-bold">جاهز للتجهيز للوسيط</span>
                      ) : (
                        <span className="text-amber-400 text-xs font-bold" title={readiness.errors.join(' ')}>
                          بيانات ناقصة — لا يتم الإرسال
                        </span>
                      );
                    })()}
                  </div>
                  <div className="col-span-2 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                    <span className="text-[10px] text-zinc-500 block mb-1">العنوان بالتفصيل</span>
                    <span className="text-zinc-300">{selectedOrder.address}</span>
                  </div>
                  {selectedOrder.landmark && (
                    <div className="col-span-2 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                      <span className="text-[10px] text-zinc-500 block mb-1">أقرب نقطة دالة</span>
                      <span className="text-zinc-300">{selectedOrder.landmark}</span>
                    </div>
                  )}

                  {selectedOrder.notes && (
                    <div className="col-span-2 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                      <span className="text-[10px] text-zinc-500 block mb-1">ملاحظة الطلب العامة</span>
                      <span className="text-zinc-300 whitespace-pre-wrap">{selectedOrder.notes}</span>
                    </div>
                  )}
                  {selectedOrder.internalNotes && (
                    <div className="col-span-2 p-3 bg-swiss-lavender/5 border border-swiss-lavender/20 rounded">
                      <span className="text-[10px] text-swiss-lavender block mb-1">ملاحظات داخلية</span>
                      <span className="text-zinc-200 whitespace-pre-wrap">{selectedOrder.internalNotes}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-zinc-800 pt-4 flex justify-end gap-3">
              {isEditingOrder ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveOrderChanges}
                    className="px-6 py-2.5 swiss-btn-lavender text-xs cursor-pointer font-bold"
                  >
                    حفظ التغييرات
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-6 py-2.5 swiss-btn-neutral text-xs cursor-pointer font-bold"
                  >
                    إلغاء التعديل
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="px-6 py-2.5 swiss-btn-lavender text-xs cursor-pointer font-bold"
                  >
                    تعديل البيانات
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-2.5 swiss-btn-neutral text-xs cursor-pointer font-bold"
                  >
                    إغلاق النافذة
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Date Range Picker & Column Customization Modal for Statistics */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 p-6 rounded-lg max-h-[90vh] overflow-y-auto space-y-6 text-right select-none animate-zoomIn">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-swiss-lavender" />
                <span>تصدير إحصائيات الطلبات</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
              اختر النطاق الزمني وقم بتخصيص ترتيب وتحديد الأعمدة المطلوبة لتوليد التقرير المخصص للمبيعات. يتم حفظ الترتيب كقالب افتراضي لعمليات التصدير القادمة.
            </p>

            {/* Error Message */}
            {statsError && (
              <div className="flex items-center gap-2 p-3 bg-red-950/20 border border-red-800 text-red-300 text-xs font-semibold rounded">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statsError}</span>
              </div>
            )}

            {/* Date Inputs Section */}
            <div className="grid grid-cols-2 gap-4 bg-zinc-950/20 p-4 border border-zinc-800 rounded-lg">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">من تاريخ</label>
                <input
                  type="date"
                  value={statsStartDate}
                  onChange={(e) => setStatsStartDate(e.target.value)}
                  className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">إلى تاريخ</label>
                <input
                  type="date"
                  value={statsEndDate}
                  onChange={(e) => setStatsEndDate(e.target.value)}
                  className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                />
              </div>

              {/* Format Selection Selector */}
              <div className="space-y-1.5 col-span-2 border-t border-zinc-800/60 pt-4 mt-2">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-2">صيغة التصدير</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat('pdf')}
                    className={`flex-1 py-2 text-xs font-bold rounded border transition-all cursor-pointer ${
                      exportFormat === 'pdf'
                        ? 'bg-swiss-lavender/10 text-swiss-lavender border-swiss-lavender/30'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    تصدير كملف PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('excel')}
                    className={`flex-1 py-2 text-xs font-bold rounded border transition-all cursor-pointer ${
                      exportFormat === 'excel'
                        ? 'bg-swiss-lavender/10 text-swiss-lavender border-swiss-lavender/30'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    تصدير كجدول Excel
                  </button>
                </div>
              </div>

              {/* Daily Orders Summary Toggle */}
              <div className="col-span-2 flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-lg mt-2">
                <div className="text-right">
                  <span className="block text-xs font-bold text-zinc-200">تضمين إحصائيات الطلبات اليومية</span>
                  <span className="block text-[10px] text-zinc-500 font-medium mt-0.5">تجميع عدد الطلبات لكل يوم وعرضها كجدول ملخص</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeDailySummary}
                    onChange={(e) => setIncludeDailySummary(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-swiss-lavender peer-checked:after:bg-zinc-950 peer-checked:after:border-zinc-950"></div>
                </label>
              </div>
            </div>

            {/* Column Customizer UI */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h4 className="text-xs font-bold text-swiss-lavender">تحديد وترتيب أعمدة الإحصائيات ({statsColumns.length} عمود)</h4>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('إعادة ضبط ترتيب وتحديد الأعمدة للمعيار الأصلي؟')) {
                      setStatsColumns(DEFAULT_STATS_COLUMNS);
                      localStorage.setItem('stats_export_preset', JSON.stringify(DEFAULT_STATS_COLUMNS));
                    }
                  }}
                  className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors cursor-pointer"
                >
                  إعادة ضبط الافتراضي
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {statsColumns.map((col, index) => (
                  <div 
                    key={col.field} 
                    className={`flex items-center justify-between p-2.5 border border-zinc-800 rounded-md transition-all ${
                      col.enabled ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-950/20 border-zinc-900/40 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatsColumn(index)}
                        className="text-zinc-500 hover:text-white cursor-pointer transition-colors"
                      >
                        {col.enabled ? (
                          <CheckSquare className="w-4.5 h-4.5 text-swiss-lavender" />
                        ) : (
                          <Square className="w-4.5 h-4.5" />
                        )}
                      </button>
                      {/* Index & Name */}
                      <span className="text-[10px] font-bold text-zinc-500 font-mono w-4">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-zinc-200">
                        {col.header}
                      </span>
                    </div>

                    {/* Move controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveStatsColumn(index, 'up')}
                        disabled={index === 0}
                        className="p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 rounded text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="تحريك للأعلى"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStatsColumn(index, 'down')}
                        disabled={index === statsColumns.length - 1}
                        className="p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 rounded text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="تحريك للأسفل"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-zinc-800 pt-4 font-semibold">
              <button
                type="button"
                disabled={exportingStats}
                onClick={handleExportPDF}
                className="flex-1 py-2.5 swiss-btn-lavender text-xs cursor-pointer font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {exportingStats ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>جاري التوليد...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 text-zinc-950" />
                    <span>{exportFormat === 'excel' ? 'توليد وتصدير ملف Excel' : 'توليد وتصدير PDF الطباعة'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2.5 swiss-btn-neutral text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
