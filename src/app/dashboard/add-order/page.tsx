'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import SearchableSelect, { type SearchableOption } from '@/components/waseet/SearchableSelect';
import type {
  WaseetMetadataCity,
  WaseetMetadataPackageSize,
  WaseetMetadataRegion,
  WaseetParseResult,
} from '@/modules/waseet/types';

interface CourseType {
  id: number;
  name: string;
  defaultPrice: number;
}

interface OrderFormState {
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

const INITIAL_FORM: OrderFormState = {
  studentName: '',
  phone1: '',
  phone2: '',
  waseetCityId: null,
  waseetRegionId: null,
  addressDetails: '',
  locationHint: '',
  waseetPackageSizeId: null,
  collectionAmount: 250_000,
  itemsCount: 1,
  replacement: false,
  goodsType: 'كورس تعليمي',
  merchantNotes: '',
  receiptNumber: '',
  courseTypeId: 1,
  internalNotes: '',
  telegramUsername: '',
};

function apiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) return String(payload.error);
  return fallback;
}

function courseAmount(defaultPrice: number): number {
  const price = Number(defaultPrice) || 0;
  return price > 0 && price < 10_000 ? Math.round(price * 1_000) : Math.round(price);
}

function reviewLabel(state: 'matched' | 'review' | 'missing') {
  if (state === 'matched') return { icon: '✓', className: 'text-emerald-300', label: 'تم التعرف' };
  if (state === 'review') return { icon: '⚠', className: 'text-amber-300', label: 'يحتاج مراجعة' };
  return { icon: '—', className: 'text-zinc-500', label: 'غير موجود' };
}

export default function AddOrderPage() {
  const [form, setForm] = useState<OrderFormState>(INITIAL_FORM);
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<WaseetParseResult | null>(null);
  const [cities, setCities] = useState<WaseetMetadataCity[]>([]);
  const [regions, setRegions] = useState<WaseetMetadataRegion[]>([]);
  const [packageSizes, setPackageSizes] = useState<WaseetMetadataPackageSize[]>([]);
  const [courses, setCourses] = useState<CourseType[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [savingMode, setSavingMode] = useState<'save' | 'dispatch' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<null | {
    order: Record<string, unknown>;
    confirmationMessage: string;
    warning?: string;
    dispatchFailed?: boolean;
  }>(null);
  const [copied, setCopied] = useState(false);
  const [reviewedPayload, setReviewedPayload] = useState('');

  const currentPayload = JSON.stringify(form);
  const reviewConfirmed = reviewedPayload === currentPayload;

  const availableRegions = useMemo(
    () => regions.filter(region => region.cityId === form.waseetCityId),
    [regions, form.waseetCityId],
  );

  async function loadMetadata(refresh = false) {
    refresh ? setRefreshingMetadata(true) : setLoadingMetadata(true);
    setError('');
    try {
      const response = await fetch(`/api/waseet/metadata${refresh ? '?refresh=1' : ''}`, {
        method: refresh ? 'POST' : 'GET',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, 'تعذر تحميل قوائم الوسيط.'));
      setCities(payload.cities || []);
      setRegions(payload.regions || []);
      setPackageSizes(payload.packageSizes || []);
      setForm(current => {
        const selectionStillExists = (payload.packageSizes || []).some(
          (size: WaseetMetadataPackageSize) => size.id === current.waseetPackageSizeId,
        );
        return {
          ...current,
          waseetPackageSizeId: selectionStillExists ? current.waseetPackageSizeId : null,
        };
      });
    } catch (metadataError) {
      setError(metadataError instanceof Error ? metadataError.message : 'تعذر تحميل قوائم الوسيط.');
    } finally {
      setLoadingMetadata(false);
      setRefreshingMetadata(false);
    }
  }

  useEffect(() => {
    void loadMetadata();
    void Promise.all([
      fetch('/api/course-types').then(response => response.json()),
      fetch('/api/orders/next-receipt').then(response => response.json()),
    ]).then(([courseData, receiptData]) => {
      const loadedCourses = Array.isArray(courseData) ? courseData : courseData.courseTypes || [];
      setCourses(loadedCourses);
      const firstCourse = loadedCourses[0] as CourseType | undefined;
      setForm(current => ({
        ...current,
        courseTypeId: firstCourse?.id || current.courseTypeId,
        collectionAmount: firstCourse ? courseAmount(firstCourse.defaultPrice) : current.collectionAmount,
        receiptNumber: receiptData.nextReceiptNumber || current.receiptNumber,
      }));
    }).catch(() => undefined);
  }, []);

  function setField<K extends keyof OrderFormState>(field: K, value: OrderFormState[K]) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function applyParse(result: WaseetParseResult) {
    setParseResult(result);
    setForm(current => ({
      ...current,
      studentName: result.fields.studentName.value || current.studentName,
      phone1: result.fields.phone1.value || current.phone1,
      phone2: result.fields.phone2.value || current.phone2,
      waseetCityId: result.fields.city.value?.id || current.waseetCityId,
      waseetRegionId: result.fields.region.value?.id || null,
      addressDetails: result.fields.addressDetails.value || current.addressDetails,
      locationHint: result.fields.locationHint.value || current.locationHint,
      collectionAmount: result.fields.collectionAmount.value || current.collectionAmount,
      itemsCount: result.fields.itemsCount.value || current.itemsCount,
      goodsType: result.fields.goodsType.value || current.goodsType,
      merchantNotes: result.fields.merchantNotes.value || current.merchantNotes,
    }));
  }

  async function handleParse() {
    if (!rawText.trim()) {
      setError('ألصق رسالة الطالب أولاً.');
      return;
    }
    setParsing(true);
    setError('');
    try {
      const response = await fetch('/api/waseet/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, 'تعذر تحليل الرسالة.'));
      applyParse(payload as WaseetParseResult);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'تعذر تحليل الرسالة.');
    } finally {
      setParsing(false);
    }
  }

  function clientValidation(): string[] {
    const errors: string[] = [];
    if (!form.studentName.trim()) errors.push('اسم الطالب/المستلم مطلوب.');
    if (!form.phone1.trim()) errors.push('الهاتف الأساسي مطلوب.');
    if (!form.waseetCityId) errors.push('اختر محافظة من قائمة الوسيط.');
    if (!form.waseetRegionId) errors.push('اختر منطقة من مناطق المحافظة الرسمية.');
    if (!form.addressDetails.trim()) errors.push('تفاصيل العنوان مطلوبة.');
    if (!form.waseetPackageSizeId) errors.push('اختر حجم الطرد.');
    if (!Number.isSafeInteger(Number(form.collectionAmount)) || Number(form.collectionAmount) <= 0) {
      errors.push('المبلغ المطلوب تحصيله غير صالح.');
    }
    return errors;
  }

  async function handleSave(dispatchNow: boolean) {
    const errors = clientValidation();
    if (dispatchNow && !reviewConfirmed) {
      errors.push('أكد مراجعة جميع بيانات الطلب قبل الإرسال إلى الوسيط.');
    }
    if (errors.length > 0) {
      setError(errors.join(' '));
      return;
    }
    setSavingMode(dispatchNow ? 'dispatch' : 'save');
    setError('');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, dispatchNow, reviewConfirmed }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, 'تعذر إنشاء الطلب.'));
      setSuccess({
        order: payload.order,
        confirmationMessage: payload.confirmationMessage || '',
        warning: payload.warning,
        dispatchFailed: Boolean(payload.dispatchFailed),
      });
      setReviewedPayload('');
      setParseResult(null);
      setRawText('');
      const nextReceipt = await fetch('/api/orders/next-receipt').then(result => result.json()).catch(() => ({}));
      setForm(current => ({
        ...INITIAL_FORM,
        courseTypeId: current.courseTypeId,
        collectionAmount: current.collectionAmount,
        waseetPackageSizeId: current.waseetPackageSizeId,
        receiptNumber: nextReceipt.nextReceiptNumber || '',
      }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'تعذر إنشاء الطلب.');
    } finally {
      setSavingMode(null);
    }
  }

  async function copyConfirmation() {
    if (!success?.confirmationMessage) return;
    await navigator.clipboard.writeText(success.confirmationMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  const cityOptions: SearchableOption[] = cities.map(city => ({ id: city.id, name: city.name }));
  const regionOptions: SearchableOption[] = availableRegions.map(region => ({ id: region.id, name: region.name }));
  const packageOptions: SearchableOption[] = packageSizes.map(size => ({ id: size.id, name: size.name }));
  const courseOptions: SearchableOption[] = courses.map(course => ({
    id: course.id,
    name: course.name,
    subtitle: `${courseAmount(course.defaultPrice).toLocaleString('ar-IQ')} د.ع`,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-8 space-y-6" dir="rtl">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-swiss-lavender/25 bg-swiss-lavender/10 px-3 py-1 text-[11px] font-bold text-swiss-lavender">
            <Package className="h-3.5 w-3.5" />
            Waseet-native Order
          </div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">إضافة طلب للوسيط</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            الطلب يُنشأ منذ البداية بمعرفات المحافظة والمنطقة والحجم الرسمية، ولا توجد محافظة أو منطقة افتراضية مخمّنة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadMetadata(true)}
          disabled={refreshingMetadata}
          className="swiss-btn-neutral inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshingMetadata ? 'animate-spin' : ''}`} />
          تحديث قوائم الوسيط
        </button>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr]">
        <div className="space-y-6">
          <div className="swiss-card rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sparkles className="h-4 w-4 text-swiss-lavender" />
                  تحليل رسالة الطالب
                </h2>
                <p className="mt-1 text-[11px] text-zinc-500">التحليل يملأ النموذج فقط، ولا يرسل الطلب تلقائياً.</p>
              </div>
            </div>
            <textarea
              value={rawText}
              onChange={event => setRawText(event.target.value)}
              className="swiss-input min-h-64 w-full resize-y p-4 text-sm leading-7"
              placeholder="ألصق رسالة الطالب هنا..."
            />
            <button
              type="button"
              onClick={() => void handleParse()}
              disabled={parsing || loadingMetadata}
              className="swiss-btn-lavender flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-50"
            >
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              تحليل ومطابقة قوائم الوسيط
            </button>
          </div>

          {parseResult ? (
            <div className="swiss-card rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">نتيجة الاستخراج</h2>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                  parseResult.reviewRequired
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                }`}>
                  {parseResult.reviewRequired ? 'تحتاج مراجعة' : 'مطابقة عالية'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries({
                  'الاسم': parseResult.fields.studentName,
                  'الهاتف': parseResult.fields.phone1,
                  'المحافظة': parseResult.fields.city,
                  'المنطقة': parseResult.fields.region,
                  'العنوان': parseResult.fields.addressDetails,
                  'المبلغ': parseResult.fields.collectionAmount,
                }).map(([label, field]) => {
                  const config = reviewLabel(field.state);
                  return (
                    <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                      <span className="block text-zinc-500">{label}</span>
                      <span className={`mt-1 block font-bold ${config.className}`}>{config.icon} {config.label}</span>
                    </div>
                  );
                })}
              </div>
              {parseResult.warnings.length ? (
                <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200">
                  {parseResult.warnings.map(warning => <p key={warning}>• {warning}</p>)}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <form className="swiss-card rounded-xl p-5 md:p-6 space-y-7" onSubmit={event => event.preventDefault()}>
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-swiss-lavender/20 bg-swiss-lavender/10">
              <ClipboardCheck className="h-5 w-5 text-swiss-lavender" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">مراجعة بيانات الطلب</h2>
              <p className="text-[11px] text-zinc-500">المعرفات الرسمية هي مصدر الحقيقة، والنصوص تُحفظ كنسخة للعرض.</p>
            </div>
          </div>

          <fieldset className="space-y-4">
            <legend className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-200">
              <User className="h-4 w-4 text-swiss-lavender" /> بيانات الطالب
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold text-zinc-300">اسم الطالب/المستلم *</span>
                <input value={form.studentName} onChange={event => setField('studentName', event.target.value)} className="swiss-input w-full px-3 py-2.5 text-sm" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-300">الهاتف الأساسي *</span>
                <input dir="ltr" value={form.phone1} onChange={event => setField('phone1', event.target.value)} className="swiss-input w-full px-3 py-2.5 text-left text-sm" placeholder="07700000000" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-300">الهاتف البديل</span>
                <input dir="ltr" value={form.phone2} onChange={event => setField('phone2', event.target.value)} className="swiss-input w-full px-3 py-2.5 text-left text-sm" placeholder="اختياري" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-300">معرف تليجرام</span>
                <input dir="ltr" value={form.telegramUsername} onChange={event => setField('telegramUsername', event.target.value)} className="swiss-input w-full px-3 py-2.5 text-left text-sm" placeholder="username" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-300">رقم الوصل</span>
                <input value={form.receiptNumber} onChange={event => setField('receiptNumber', event.target.value)} className="swiss-input w-full px-3 py-2.5 text-sm" />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-zinc-800 pt-6">
            <legend className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-200">
              <MapPin className="h-4 w-4 text-swiss-lavender" /> بيانات الشحن الرسمية
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <SearchableSelect
                label="محافظة الوسيط"
                required
                loading={loadingMetadata}
                value={form.waseetCityId}
                options={cityOptions}
                onChange={option => setForm(current => ({
                  ...current,
                  waseetCityId: option ? Number(option.id) : null,
                  waseetRegionId: null,
                }))}
                placeholder="ابحث واختر المحافظة"
              />
              <SearchableSelect
                label="منطقة الوسيط"
                required
                disabled={!form.waseetCityId}
                value={form.waseetRegionId}
                options={regionOptions}
                onChange={option => setField('waseetRegionId', option ? Number(option.id) : null)}
                placeholder={form.waseetCityId ? 'ابحث واختر المنطقة' : 'اختر المحافظة أولاً'}
                hint="تظهر فقط المناطق التابعة للمحافظة المحددة."
              />
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold text-zinc-300">تفاصيل العنوان داخل المنطقة *</span>
                <textarea value={form.addressDetails} onChange={event => setField('addressDetails', event.target.value)} className="swiss-input min-h-24 w-full p-3 text-sm" placeholder="المحلة، الشارع، الزقاق، رقم الدار..." />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold text-zinc-300">أقرب نقطة دالة</span>
                <input value={form.locationHint} onChange={event => setField('locationHint', event.target.value)} className="swiss-input w-full px-3 py-2.5 text-sm" placeholder="قرب، مقابل، يم..." />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-zinc-800 pt-6">
            <legend className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-200">
              <Package className="h-4 w-4 text-swiss-lavender" /> بيانات الشحنة
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <SearchableSelect
                label="الدورة"
                value={form.courseTypeId}
                options={courseOptions}
                onChange={option => {
                  if (!option) return;
                  const course = courses.find(item => item.id === Number(option.id));
                  setForm(current => ({
                    ...current,
                    courseTypeId: Number(option.id),
                    collectionAmount: course ? courseAmount(course.defaultPrice) : current.collectionAmount,
                  }));
                }}
              />
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-300">نوع البضاعة</span>
                <input
                  value={form.goodsType}
                  onChange={event => setField('goodsType', event.target.value)}
                  className="swiss-input w-full px-3 py-2.5 text-sm"
                  placeholder="مثال: كورس تعليمي"
                />
              </label>
              <SearchableSelect
                label="حجم الطرد من الوسيط"
                required
                loading={loadingMetadata}
                value={form.waseetPackageSizeId}
                options={packageOptions}
                onChange={option => setField('waseetPackageSizeId', option ? Number(option.id) : null)}
              />
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-300">عدد القطع *</span>
                <input type="number" min={1} value={form.itemsCount} onChange={event => setField('itemsCount', Number(event.target.value))} className="swiss-input w-full px-3 py-2.5 text-sm" />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold text-zinc-300">المبلغ المطلوب تحصيله من العميل (د.ع) *</span>
                <input type="number" min={1} step={1000} value={form.collectionAmount} onChange={event => setField('collectionAmount', Number(event.target.value))} className="swiss-input w-full px-3 py-3 text-lg font-bold" />
                <span className="block text-[11px] text-zinc-500">لا يوجد حقل سعر توصيل محلي؛ أجور الشركة وصافي التاجر تأتي من الوسيط بعد الإرسال.</span>
              </label>
              <label className="md:col-span-2 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <input type="checkbox" checked={form.replacement} onChange={event => setField('replacement', event.target.checked)} className="h-4 w-4 accent-[#b09ff6]" />
                <span className="text-xs font-bold text-zinc-300">الطلب يحتوي استبدال/Replacement</span>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold text-zinc-300">ملاحظات التاجر للمندوب</span>
                <textarea value={form.merchantNotes} onChange={event => setField('merchantNotes', event.target.value)} className="swiss-input min-h-20 w-full p-3 text-sm" />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold text-zinc-300">ملاحظات داخلية لا تُرسل للوسيط</span>
                <textarea value={form.internalNotes} onChange={event => setField('internalNotes', event.target.value)} className="swiss-input min-h-20 w-full p-3 text-sm" />
              </label>
            </div>
          </fieldset>

          <label className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={event => setReviewedPayload(event.target.checked ? currentPayload : '')}
              disabled={savingMode !== null}
              className="mt-0.5 h-4 w-4 accent-[#b09ff6]"
            />
            <span className="text-xs leading-5 text-amber-100">
              راجعت الاسم والهواتف والموقع الرسمي والحجم والمبلغ، وأؤكد أن الطلب جاهز للإرسال. أي تعديل على البيانات يلغي هذا التأكيد.
            </span>
          </label>

          <div className="grid gap-3 border-t border-zinc-800 pt-6 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={savingMode !== null || loadingMetadata}
              className="swiss-btn-neutral flex items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-50"
            >
              {savingMode === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ محلياً
            </button>
            <button
              type="button"
              onClick={() => void handleSave(true)}
              disabled={savingMode !== null || loadingMetadata || !reviewConfirmed}
              className="swiss-btn-lavender flex items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-50"
            >
              {savingMode === 'dispatch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              حفظ وإرسال إلى الوسيط
            </button>
          </div>
        </form>
      </section>

      {success ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <h2 className="font-bold text-white">تم إنشاء الطلب</h2>
                  <p className="text-xs text-zinc-500">
                    {success.order.waseet_qr_id ? `رقم Waseet QR: ${String(success.order.waseet_qr_id)}` : 'محفوظ محلياً وجاهز للإرسال.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSuccess(null)} className="p-2 text-zinc-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            {success.warning ? (
              <div className="mt-5 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">{success.dispatchFailed ? 'تم حفظ الطلب محلياً، لكن الإرسال يحتاج انتباهاً' : 'تنبيه'}</p>
                  <p className="mt-1">{success.warning}</p>
                </div>
              </div>
            ) : null}
            {success.confirmationMessage ? (
              <>
                <pre className="mt-5 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/40 p-4 text-xs leading-6 text-zinc-200">{success.confirmationMessage}</pre>
                <button type="button" onClick={() => void copyConfirmation()} className="swiss-btn-lavender mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'تم النسخ' : 'نسخ رسالة التأكيد'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
