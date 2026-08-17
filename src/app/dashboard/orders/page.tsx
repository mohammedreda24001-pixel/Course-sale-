'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  Loader2,
  MapPin,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react';
import SearchableSelect, { type SearchableOption } from '@/components/waseet/SearchableSelect';
import { SyncStateBadge, WaseetStatusBadge } from '@/components/waseet/StatusBadge';
import type {
  WaseetMetadataCity,
  WaseetMetadataPackageSize,
  WaseetMetadataRegion,
  WaseetMetadataStatus,
  WaseetOrderRecord,
  WaseetSyncState,
} from '@/modules/waseet/types';

type PublicOrder = Omit<WaseetOrderRecord, 'waseet_qr_link' | 'waseet_raw'>;

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface EditForm {
  studentName: string;
  phone1: string;
  phone2: string;
  waseetCityId: number | null;
  waseetRegionId: number | null;
  addressDetails: string;
  locationHint: string;
  waseetPackageSizeId: number | null;
  collectionAmount: number;
  itemsCount: number;
  replacement: boolean;
  goodsType: string;
  merchantNotes: string;
  receiptNumber: string;
  courseTypeId: number;
  internalNotes: string;
  telegramUsername: string;
}

const SYNC_FILTERS: Array<{ id: WaseetSyncState | ''; name: string }> = [
  { id: '', name: 'كل حالات المزامنة' },
  { id: 'pending', name: 'جاهز للإرسال' },
  { id: 'synced', name: 'متزامن' },
  { id: 'failed', name: 'فشل' },
  { id: 'needs_verification', name: 'يحتاج تحقق' },
  { id: 'manual_review', name: 'مراجعة بيانات قديمة' },
];

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function formatCurrency(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString('ar-IQ')} د.ع`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' });
}

function localPhone(value?: string | null) {
  if (!value) return '—';
  return /^\+9647\d{9}$/.test(value) ? `0${value.slice(4)}` : value;
}

function apiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) return String(payload.error);
  return fallback;
}

function editFormFromOrder(order: PublicOrder): EditForm {
  return {
    studentName: order.studentName,
    phone1: localPhone(order.phone1),
    phone2: order.phone2 ? localPhone(order.phone2) : '',
    waseetCityId: order.waseet_city_id,
    waseetRegionId: order.waseet_region_id,
    addressDetails: order.address_details,
    locationHint: order.location_hint || '',
    waseetPackageSizeId: order.waseet_package_size_id,
    collectionAmount: Number(order.collection_amount),
    itemsCount: Number(order.items_count || 1),
    replacement: Boolean(order.replacement),
    goodsType: order.goods_type || 'كورس تعليمي',
    merchantNotes: order.merchant_notes || '',
    receiptNumber: order.receiptNumber || '',
    courseTypeId: Number(order.courseTypeId || 1),
    internalNotes: order.internal_notes || '',
    telegramUsername: order.telegram_username || '',
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<PublicOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [cityId, setCityId] = useState<number | null>(null);
  const [regionId, setRegionId] = useState<number | null>(null);
  const [syncState, setSyncState] = useState<WaseetSyncState | ''>('');
  const [statusId, setStatusId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [cities, setCities] = useState<WaseetMetadataCity[]>([]);
  const [regions, setRegions] = useState<WaseetMetadataRegion[]>([]);
  const [packageSizes, setPackageSizes] = useState<WaseetMetadataPackageSize[]>([]);
  const [statuses, setStatuses] = useState<WaseetMetadataStatus[]>([]);
  const [actionId, setActionId] = useState<number | null>(null);
  const [bulkAction, setBulkAction] = useState<null | 'dispatch' | 'sync'>(null);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, succeeded: 0, failed: 0 });
  const [detailsOrder, setDetailsOrder] = useState<PublicOrder | null>(null);
  const [editOrder, setEditOrder] = useState<PublicOrder | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const availableFilterRegions = useMemo(
    () => regions.filter(region => region.cityId === cityId),
    [regions, cityId],
  );
  const availableEditRegions = useMemo(
    () => regions.filter(region => region.cityId === editForm?.waseetCityId),
    [regions, editForm?.waseetCityId],
  );

  const loadOrders = useCallback(async (page = pagination.page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pagination.pageSize) });
      if (search) params.set('search', search);
      if (cityId) params.set('cityId', String(cityId));
      if (regionId) params.set('regionId', String(regionId));
      if (syncState) params.set('syncState', syncState);
      if (statusId) params.set('statusId', statusId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const response = await fetch(`/api/orders?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, 'تعذر تحميل الطلبات.'));
      setOrders(payload.orders || []);
      setPagination(payload.pagination || { page, pageSize: 25, total: 0, totalPages: 1 });
      setSelectedIds(current => current.filter(id => (payload.orders || []).some((order: PublicOrder) => order.id === id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الطلبات.');
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize, search, cityId, regionId, syncState, statusId, dateFrom, dateTo, pagination.page]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadOrders(1);
  }, [search, cityId, regionId, syncState, statusId, dateFrom, dateTo]);

  useEffect(() => {
    void fetch('/api/waseet/metadata')
      .then(response => response.json())
      .then(payload => {
        setCities(payload.cities || []);
        setRegions(payload.regions || []);
        setPackageSizes(payload.packageSizes || []);
        setStatuses(payload.statuses || []);
      })
      .catch(() => undefined);
  }, []);

  function replaceOrder(updated: PublicOrder) {
    setOrders(current => current.map(order => order.id === updated.id ? updated : order));
    setDetailsOrder(current => current?.id === updated.id ? updated : current);
    setEditOrder(current => current?.id === updated.id ? updated : current);
  }

  async function runOrderAction(order: PublicOrder, action: 'dispatch' | 'sync') {
    setActionId(order.id);
    setError('');
    try {
      const response = await fetch(`/api/waseet/orders/${order.id}/${action}`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, `فشل ${action === 'dispatch' ? 'الإرسال' : 'التحديث'}.`));
      replaceOrder(payload.order);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تنفيذ العملية.');
    } finally {
      setActionId(null);
    }
  }

  async function resolveUncertainDispatch(order: PublicOrder) {
    if (order.waseet_order_id && order.waseet_qr_id) {
      await runOrderAction(order, 'sync');
      return;
    }

    const answer = window.prompt(
      'تحقّق أولاً من تطبيق الوسيط. إذا وجدت الشحنة أدخل رقم الطلب في الوسيط. إذا لم تجدها اكتب بالضبط: غير موجود',
    );
    if (answer === null) return;
    const value = answer.trim();
    if (!value) {
      setError('أدخل رقم طلب الوسيط أو اكتب: غير موجود');
      return;
    }

    const notCreated = value === 'غير موجود';
    if (notCreated && !window.confirm('هل تحققت من تطبيق الوسيط وتؤكد أن الشحنة لم تُنشأ؟')) return;

    setActionId(order.id);
    setError('');
    try {
      const response = await fetch(`/api/waseet/orders/${order.id}/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          notCreated
            ? { resolution: 'not_created' }
            : { resolution: 'created', waseetOrderId: value },
        ),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, 'تعذر حسم محاولة الإرسال.'));
      replaceOrder(payload.order);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'تعذر حسم محاولة الإرسال.');
    } finally {
      setActionId(null);
    }
  }

  async function bulkDispatch() {
    if (!selectedIds.length) return;
    setBulkAction('dispatch');
    setBulkProgress({ current: 0, total: selectedIds.length, succeeded: 0, failed: 0 });
    setError('');
    for (let index = 0; index < selectedIds.length; index += 1) {
      const id = selectedIds[index];
      try {
        const response = await fetch(`/api/waseet/orders/${id}/dispatch`, { method: 'POST' });
        const payload = await response.json();
        if (!response.ok) throw new Error(apiError(payload, 'فشل الإرسال.'));
        replaceOrder(payload.order);
        setBulkProgress(current => ({ ...current, current: index + 1, succeeded: current.succeeded + 1 }));
      } catch {
        setBulkProgress(current => ({ ...current, current: index + 1, failed: current.failed + 1 }));
      }
      if (index < selectedIds.length - 1) await pause(1_050);
    }
    setBulkAction(null);
    void loadOrders();
  }

  async function bulkSync() {
    if (!selectedIds.length) return;
    setBulkAction('sync');
    setBulkProgress({ current: 0, total: selectedIds.length, succeeded: 0, failed: 0 });
    setError('');
    try {
      const response = await fetch('/api/waseet/bulk-sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, 'فشلت المزامنة الجماعية.'));
      const results = payload.results || [];
      results.forEach((result: { success: boolean; order?: PublicOrder }) => {
        if (result.order) replaceOrder(result.order);
      });
      setBulkProgress({
        current: results.length,
        total: selectedIds.length,
        succeeded: results.filter((item: { success: boolean }) => item.success).length,
        failed: results.filter((item: { success: boolean }) => !item.success).length,
      });
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'فشلت المزامنة الجماعية.');
    } finally {
      setBulkAction(null);
      void loadOrders();
    }
  }

  async function archiveOrder(order: PublicOrder) {
    if (!window.confirm(`أرشفة الطلب #${order.receiptNumber || order.id}؟`)) return;
    setActionId(order.id);
    try {
      const response = await fetch(`/api/orders?id=${order.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, 'تعذرت أرشفة الطلب.'));
      setDetailsOrder(null);
      void loadOrders();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'تعذرت أرشفة الطلب.');
    } finally {
      setActionId(null);
    }
  }

  function openEdit(order: PublicOrder) {
    setEditOrder(order);
    setEditForm(editFormFromOrder(order));
  }

  async function saveEdit() {
    if (!editOrder || !editForm) return;
    setSavingEdit(true);
    setError('');
    try {
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: editOrder.id, updates: editForm }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, 'تعذر تعديل الطلب.'));
      replaceOrder(payload.order);
      setEditOrder(null);
      setEditForm(null);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'تعذر تعديل الطلب.');
    } finally {
      setSavingEdit(false);
    }
  }

  function exportCsv() {
    const targets = selectedIds.length ? orders.filter(order => selectedIds.includes(order.id)) : orders;
    const headers = [
      'رقم الوصل', 'اسم الطالب', 'الهاتف', 'المحافظة', 'المنطقة', 'العنوان', 'المبلغ',
      'Waseet QR', 'حالة الوسيط', 'حالة المزامنة', 'آخر تحديث', 'ملاحظات السائق',
    ];
    const rows = targets.map(order => [
      order.receiptNumber || order.id,
      order.studentName,
      localPhone(order.phone1),
      order.waseet_city_name || '',
      order.waseet_region_name || '',
      `${order.address_details}${order.location_hint ? ` - ${order.location_hint}` : ''}`,
      order.collection_amount,
      order.waseet_qr_id || '',
      order.waseet_status_text || '',
      order.waseet_sync_state,
      order.waseet_last_synced_at || '',
      order.waseet_issue_notes || '',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waseet-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const allSelected = orders.length > 0 && orders.every(order => selectedIds.includes(order.id));
  const cityOptions: SearchableOption[] = cities.map(city => ({ id: city.id, name: city.name }));
  const filterRegionOptions: SearchableOption[] = availableFilterRegions.map(region => ({ id: region.id, name: region.name }));
  const statusOptions: SearchableOption[] = statuses.map(status => ({ id: status.id, name: status.name }));
  const packageOptions: SearchableOption[] = packageSizes.map(size => ({ id: size.id, name: size.name }));
  const editRegionOptions: SearchableOption[] = availableEditRegions.map(region => ({ id: region.id, name: region.name }));

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 md:p-8 space-y-5" dir="rtl">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-swiss-lavender/25 bg-swiss-lavender/10 px-3 py-1 text-[11px] font-bold text-swiss-lavender">
            <PackageCheck className="h-3.5 w-3.5" />
            Waseet Live Orders
          </div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">الطلبات والشحنات</h1>
          <p className="mt-2 text-sm text-zinc-400">حالة رحلة الشحنة تأتي من الوسيط؛ حالة المزامنة منفصلة وتوضح نجاح الاتصال فقط.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className="swiss-btn-neutral inline-flex items-center gap-2 px-4 py-2.5 text-xs">
            <Download className="h-4 w-4" /> تصدير CSV
          </button>
          <button type="button" onClick={() => void loadOrders()} className="swiss-btn-neutral inline-flex items-center gap-2 px-4 py-2.5 text-xs">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تحديث القائمة
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> {error}
        </div>
      ) : null}

      <section className="swiss-card rounded-xl p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative md:col-span-2">
            <Search className="absolute right-3 top-3 h-4 w-4 text-zinc-500" />
            <input value={searchInput} onChange={event => setSearchInput(event.target.value)} className="swiss-input w-full py-2.5 pr-10 pl-3 text-sm" placeholder="اسم، هاتف، وصل، QR..." />
          </label>
          <SearchableSelect
            label="المحافظة"
            value={cityId}
            options={cityOptions}
            onChange={option => {
              setCityId(option ? Number(option.id) : null);
              setRegionId(null);
            }}
            placeholder="كل المحافظات"
          />
          <SearchableSelect
            label="المنطقة"
            disabled={!cityId}
            value={regionId}
            options={filterRegionOptions}
            onChange={option => setRegionId(option ? Number(option.id) : null)}
            placeholder="كل المناطق"
          />
          <SearchableSelect
            label="حالة الوسيط"
            value={statusId || null}
            options={statusOptions}
            onChange={option => setStatusId(option ? String(option.id) : '')}
            placeholder="كل الحالات"
          />
          <SearchableSelect
            label="حالة المزامنة"
            value={syncState || null}
            options={SYNC_FILTERS.filter(item => item.id).map(item => ({ id: item.id, name: item.name }))}
            onChange={option => setSyncState((option?.id || '') as WaseetSyncState | '')}
            placeholder="كل الحالات"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:max-w-xl">
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-zinc-500">من تاريخ</span>
            <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="swiss-input w-full px-3 py-2 text-xs" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-zinc-500">إلى تاريخ</span>
            <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="swiss-input w-full px-3 py-2 text-xs" />
          </label>
        </div>
      </section>

      {selectedIds.length ? (
        <section className="flex flex-col gap-3 rounded-xl border border-swiss-lavender/25 bg-swiss-lavender/5 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-white">تم تحديد {selectedIds.length} طلب</p>
            {bulkProgress.total > 0 ? (
              <p className="mt-1 text-xs text-zinc-400">
                التقدم {bulkProgress.current}/{bulkProgress.total} — نجح {bulkProgress.succeeded} — فشل {bulkProgress.failed}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={bulkAction !== null} onClick={() => void bulkDispatch()} className="swiss-btn-lavender inline-flex items-center gap-2 px-4 py-2.5 text-xs disabled:opacity-50">
              {bulkAction === 'dispatch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال المحدد
            </button>
            <button type="button" disabled={bulkAction !== null} onClick={() => void bulkSync()} className="swiss-btn-neutral inline-flex items-center gap-2 px-4 py-2.5 text-xs disabled:opacity-50">
              {bulkAction === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} مزامنة المحدد
            </button>
            <button type="button" onClick={() => setSelectedIds([])} className="swiss-btn-neutral px-4 py-2.5 text-xs">إلغاء التحديد</button>
          </div>
        </section>
      ) : null}

      <section className="swiss-card overflow-hidden rounded-xl">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1180px] text-right text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-500">
              <tr>
                <th className="w-10 p-4"><input type="checkbox" checked={allSelected} onChange={event => setSelectedIds(event.target.checked ? orders.map(order => order.id) : [])} className="accent-[#b09ff6]" /></th>
                <th className="p-4">الطالب</th>
                <th className="p-4">الموقع</th>
                <th className="p-4">المبلغ</th>
                <th className="p-4">Waseet QR</th>
                <th className="p-4">حالة الوسيط</th>
                <th className="p-4">المزامنة</th>
                <th className="p-4">آخر تحديث</th>
                <th className="p-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {loading ? (
                <tr><td colSpan={9} className="p-12 text-center text-zinc-500"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-swiss-lavender" />جاري التحميل...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center text-zinc-500">لا توجد طلبات مطابقة للفلاتر.</td></tr>
              ) : orders.map(order => (
                <tr key={order.id} className="hover:bg-zinc-900/40">
                  <td className="p-4"><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, order.id] : current.filter(id => id !== order.id))} className="accent-[#b09ff6]" /></td>
                  <td className="p-4">
                    <button type="button" onClick={() => setDetailsOrder(order)} className="text-right">
                      <span className="block font-bold text-zinc-100 hover:text-swiss-lavender">{order.studentName}</span>
                      <span dir="ltr" className="mt-1 block text-[10px] text-zinc-500">{localPhone(order.phone1)} · وصل {order.receiptNumber || order.id}</span>
                    </button>
                  </td>
                  <td className="p-4">
                    <span className="block font-semibold text-zinc-300">{order.waseet_city_name || 'غير محددة'} — {order.waseet_region_name || 'غير محددة'}</span>
                    <span className="mt-1 block max-w-56 truncate text-[10px] text-zinc-500">{order.address_details}</span>
                  </td>
                  <td className="p-4 font-bold text-zinc-100">{formatCurrency(order.collection_amount)}</td>
                  <td className="p-4 font-mono text-zinc-300">{order.waseet_qr_id || '—'}</td>
                  <td className="p-4"><WaseetStatusBadge status={order.waseet_status_text} /></td>
                  <td className="p-4"><SyncStateBadge state={order.waseet_sync_state} /></td>
                  <td className="p-4 text-[10px] text-zinc-500">{formatDate(order.waseet_last_synced_at || order.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setDetailsOrder(order)} className="rounded-md border border-zinc-700 p-2 text-zinc-400 hover:text-white" title="التفاصيل"><Eye className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => openEdit(order)} className="rounded-md border border-zinc-700 p-2 text-zinc-400 hover:text-white" title="تعديل"><Edit3 className="h-3.5 w-3.5" /></button>
                      {!order.waseet_qr_id ? (
                        order.waseet_sync_state === 'needs_verification' ? (
                          <button type="button" disabled={actionId === order.id} onClick={() => void resolveUncertainDispatch(order)} className="rounded-md border border-amber-500/30 p-2 text-amber-300 disabled:opacity-40" title={order.waseet_order_id ? "مزامنة الشحنة للتحقق" : "حسم محاولة إرسال غير مؤكدة"}><AlertCircle className="h-3.5 w-3.5" /></button>
                        ) : (
                          <button type="button" disabled={actionId === order.id} onClick={() => void runOrderAction(order, 'dispatch')} className="rounded-md border border-swiss-lavender/30 p-2 text-swiss-lavender disabled:opacity-40" title="إرسال"><Send className="h-3.5 w-3.5" /></button>
                        )
                      ) : (
                        <button type="button" disabled={actionId === order.id} onClick={() => void runOrderAction(order, 'sync')} className="rounded-md border border-zinc-700 p-2 text-zinc-400 hover:text-white disabled:opacity-40" title="مزامنة"><RefreshCw className={`h-3.5 w-3.5 ${actionId === order.id ? 'animate-spin' : ''}`} /></button>
                      )}
                      {order.waseet_qr_id ? <a href={`/api/waseet/orders/${order.id}/label`} target="_blank" rel="noreferrer" className="rounded-md border border-zinc-700 p-2 text-zinc-400 hover:text-white" title="الملصق"><Printer className="h-3.5 w-3.5" /></a> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-zinc-800 lg:hidden">
          {loading ? <div className="p-10 text-center text-zinc-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : null}
          {!loading && orders.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">لا توجد طلبات.</div> : null}
          {orders.map(order => (
            <article key={order.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedIds.includes(order.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, order.id] : current.filter(id => id !== order.id))} className="mt-1 accent-[#b09ff6]" />
                  <div>
                    <h3 className="font-bold text-white">{order.studentName}</h3>
                    <p dir="ltr" className="mt-1 text-left text-[11px] text-zinc-500">{localPhone(order.phone1)}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-zinc-200">{formatCurrency(order.collection_amount)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400"><MapPin className="h-4 w-4 text-zinc-600" />{order.waseet_city_name || '—'} — {order.waseet_region_name || '—'}</div>
              <div className="flex flex-wrap gap-2"><WaseetStatusBadge status={order.waseet_status_text} /><SyncStateBadge state={order.waseet_sync_state} /></div>
              <div className="grid grid-cols-4 gap-2">
                <button type="button" onClick={() => setDetailsOrder(order)} className="swiss-btn-neutral flex items-center justify-center p-2.5"><Eye className="h-4 w-4" /></button>
                <button type="button" onClick={() => openEdit(order)} className="swiss-btn-neutral flex items-center justify-center p-2.5"><Edit3 className="h-4 w-4" /></button>
                {!order.waseet_qr_id ? (
                  order.waseet_sync_state === 'needs_verification' ? (
                    <button type="button" disabled={actionId === order.id} onClick={() => void resolveUncertainDispatch(order)} className="flex items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300 disabled:opacity-40"><AlertCircle className="h-4 w-4" /></button>
                  ) : (
                    <button type="button" disabled={actionId === order.id} onClick={() => void runOrderAction(order, 'dispatch')} className="swiss-btn-lavender flex items-center justify-center p-2.5 disabled:opacity-40"><Send className="h-4 w-4" /></button>
                  )
                ) : (
                  <button type="button" onClick={() => void runOrderAction(order, 'sync')} className="swiss-btn-neutral flex items-center justify-center p-2.5"><RefreshCw className="h-4 w-4" /></button>
                )}
                {order.waseet_qr_id ? <a href={`/api/waseet/orders/${order.id}/label`} target="_blank" rel="noreferrer" className="swiss-btn-neutral flex items-center justify-center p-2.5"><Printer className="h-4 w-4" /></a> : <span />}
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-zinc-500">إجمالي النتائج: {pagination.total.toLocaleString('ar-IQ')}</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={pagination.page <= 1 || loading} onClick={() => void loadOrders(pagination.page - 1)} className="swiss-btn-neutral p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <span className="min-w-28 text-center text-xs text-zinc-400">صفحة {pagination.page} من {pagination.totalPages}</span>
          <button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void loadOrders(pagination.page + 1)} className="swiss-btn-neutral p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        </div>
      </footer>

      {detailsOrder ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-xl overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-5 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{detailsOrder.studentName}</h2>
                <p className="mt-1 text-xs text-zinc-500">وصل #{detailsOrder.receiptNumber || detailsOrder.id}</p>
              </div>
              <button type="button" onClick={() => setDetailsOrder(null)} className="p-2 text-zinc-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2"><WaseetStatusBadge status={detailsOrder.waseet_status_text} /><SyncStateBadge state={detailsOrder.waseet_sync_state} /></div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['الهاتف', localPhone(detailsOrder.phone1)],
                ['الهاتف البديل', localPhone(detailsOrder.phone2)],
                ['المحافظة', detailsOrder.waseet_city_name || '—'],
                ['المنطقة', detailsOrder.waseet_region_name || '—'],
                ['حجم الطرد', detailsOrder.waseet_package_size_name || '—'],
                ['عدد القطع', detailsOrder.items_count],
                ['المبلغ', formatCurrency(detailsOrder.collection_amount)],
                ['Waseet QR', detailsOrder.waseet_qr_id || '—'],
                ['آخر مزامنة', formatDate(detailsOrder.waseet_last_synced_at)],
                ['صافي التاجر', detailsOrder.waseet_merchant_price == null ? '—' : formatCurrency(detailsOrder.waseet_merchant_price)],
                ['أجرة التوصيل', detailsOrder.waseet_delivery_price == null ? '—' : formatCurrency(detailsOrder.waseet_delivery_price)],
                ['الفاتورة', detailsOrder.waseet_invoice_id || '—'],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <dt className="text-[10px] font-bold text-zinc-500">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-zinc-200">{String(value)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-zinc-800 p-4"><h3 className="text-xs font-bold text-zinc-500">العنوان</h3><p className="mt-2 text-sm leading-7 text-zinc-200">{detailsOrder.address_details}{detailsOrder.location_hint ? ` — دالة: ${detailsOrder.location_hint}` : ''}</p></div>
              {detailsOrder.waseet_issue_notes ? <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4"><h3 className="text-xs font-bold text-amber-300">ملاحظة السائق</h3><p className="mt-2 text-sm text-amber-100">{detailsOrder.waseet_issue_notes}</p></div> : null}
              {detailsOrder.waseet_last_error ? <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-4"><h3 className="text-xs font-bold text-red-300">آخر خطأ مزامنة</h3><p className="mt-2 text-sm text-red-100">{detailsOrder.waseet_last_error}</p></div> : null}
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => openEdit(detailsOrder)} className="swiss-btn-lavender flex items-center justify-center gap-2 px-4 py-3 text-sm"><Edit3 className="h-4 w-4" />تعديل الطلب</button>
              {detailsOrder.waseet_qr_id ? (
                <a href={`/api/waseet/orders/${detailsOrder.id}/label`} target="_blank" rel="noreferrer" className="swiss-btn-neutral flex items-center justify-center gap-2 px-4 py-3 text-sm"><Printer className="h-4 w-4" />فتح الملصق</a>
              ) : detailsOrder.waseet_sync_state === 'needs_verification' ? (
                <button type="button" onClick={() => void resolveUncertainDispatch(detailsOrder)} className="flex items-center justify-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200"><AlertCircle className="h-4 w-4" />{detailsOrder.waseet_order_id ? 'مزامنة للتحقق من التعديل' : 'حسم محاولة الإرسال'}</button>
              ) : (
                <button type="button" onClick={() => void runOrderAction(detailsOrder, 'dispatch')} className="swiss-btn-neutral flex items-center justify-center gap-2 px-4 py-3 text-sm"><Send className="h-4 w-4" />إرسال</button>
              )}
              {!detailsOrder.waseet_qr_id && detailsOrder.waseet_sync_state !== 'needs_verification' ? <button type="button" onClick={() => void archiveOrder(detailsOrder)} className="sm:col-span-2 flex items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300"><Archive className="h-4 w-4" />أرشفة الطلب</button> : null}
            </div>
          </div>
        </div>
      ) : null}

      {editOrder && editForm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3" role="dialog" aria-modal="true">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div><h2 className="font-bold text-white">تعديل الطلب #{editOrder.receiptNumber || editOrder.id}</h2><p className="mt-1 text-xs text-zinc-500">إذا كانت الشحنة مرسلة فسيتم تعديلها في الوسيط أولاً، ثم تُحفظ محلياً.</p></div>
              <button type="button" onClick={() => { setEditOrder(null); setEditForm(null); }} className="p-2 text-zinc-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2"><span className="text-xs font-bold text-zinc-300">الاسم</span><input value={editForm.studentName} onChange={event => setEditForm(current => current ? ({ ...current, studentName: event.target.value }) : current)} className="swiss-input w-full px-3 py-2.5 text-sm" /></label>
              <label className="space-y-1"><span className="text-xs font-bold text-zinc-300">الهاتف</span><input dir="ltr" value={editForm.phone1} onChange={event => setEditForm(current => current ? ({ ...current, phone1: event.target.value }) : current)} className="swiss-input w-full px-3 py-2.5 text-left text-sm" /></label>
              <label className="space-y-1"><span className="text-xs font-bold text-zinc-300">الهاتف البديل</span><input dir="ltr" value={editForm.phone2} onChange={event => setEditForm(current => current ? ({ ...current, phone2: event.target.value }) : current)} className="swiss-input w-full px-3 py-2.5 text-left text-sm" /></label>
              <SearchableSelect label="المحافظة" required value={editForm.waseetCityId} options={cityOptions} onChange={option => setEditForm(current => current ? ({ ...current, waseetCityId: option ? Number(option.id) : null, waseetRegionId: null }) : current)} />
              <SearchableSelect label="المنطقة" required disabled={!editForm.waseetCityId} value={editForm.waseetRegionId} options={editRegionOptions} onChange={option => setEditForm(current => current ? ({ ...current, waseetRegionId: option ? Number(option.id) : null }) : current)} />
              <label className="space-y-1 md:col-span-2"><span className="text-xs font-bold text-zinc-300">تفاصيل العنوان</span><textarea value={editForm.addressDetails} onChange={event => setEditForm(current => current ? ({ ...current, addressDetails: event.target.value }) : current)} className="swiss-input min-h-20 w-full p-3 text-sm" /></label>
              <label className="space-y-1 md:col-span-2"><span className="text-xs font-bold text-zinc-300">نقطة الدالة</span><input value={editForm.locationHint} onChange={event => setEditForm(current => current ? ({ ...current, locationHint: event.target.value }) : current)} className="swiss-input w-full px-3 py-2.5 text-sm" /></label>
              <SearchableSelect label="حجم الطرد" required value={editForm.waseetPackageSizeId} options={packageOptions} onChange={option => setEditForm(current => current ? ({ ...current, waseetPackageSizeId: option ? Number(option.id) : null }) : current)} />
              <label className="space-y-1"><span className="text-xs font-bold text-zinc-300">المبلغ المطلوب تحصيله</span><input type="number" min={1} value={editForm.collectionAmount} onChange={event => setEditForm(current => current ? ({ ...current, collectionAmount: Number(event.target.value) }) : current)} className="swiss-input w-full px-3 py-2.5 text-sm" /></label>
              <label className="space-y-1"><span className="text-xs font-bold text-zinc-300">عدد القطع</span><input type="number" min={1} value={editForm.itemsCount} onChange={event => setEditForm(current => current ? ({ ...current, itemsCount: Number(event.target.value) }) : current)} className="swiss-input w-full px-3 py-2.5 text-sm" /></label>
              <label className="space-y-1"><span className="text-xs font-bold text-zinc-300">نوع البضاعة</span><input value={editForm.goodsType} onChange={event => setEditForm(current => current ? ({ ...current, goodsType: event.target.value }) : current)} className="swiss-input w-full px-3 py-2.5 text-sm" /></label>
              <label className="md:col-span-2 flex items-center gap-3 rounded-lg border border-zinc-800 p-3"><input type="checkbox" checked={editForm.replacement} onChange={event => setEditForm(current => current ? ({ ...current, replacement: event.target.checked }) : current)} className="accent-[#b09ff6]" /><span className="text-xs font-bold text-zinc-300">طلب استبدال</span></label>
              <label className="space-y-1 md:col-span-2"><span className="text-xs font-bold text-zinc-300">ملاحظات التاجر</span><textarea value={editForm.merchantNotes} onChange={event => setEditForm(current => current ? ({ ...current, merchantNotes: event.target.value }) : current)} className="swiss-input min-h-20 w-full p-3 text-sm" /></label>
            </div>
            <button type="button" disabled={savingEdit} onClick={() => void saveEdit()} className="swiss-btn-lavender mt-6 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-50">
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} حفظ التعديل
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
