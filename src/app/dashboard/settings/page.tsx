'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Database,
  FileCode2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Trash2,
  X,
} from 'lucide-react';

interface AppSettings {
  requestTemplate: string;
  confirmationTemplate: string;
  defaultOrderNote: string;
}

interface CourseType {
  id: number;
  name: string;
  defaultPrice: number;
}

interface MetadataSummary {
  cities: number;
  regions: number;
  packageSizes: number;
  statuses: number;
}

const PLACEHOLDERS = [
  ['{name}', 'اسم الطالب/المستلم'],
  ['{phone1}', 'الهاتف الأساسي'],
  ['{phone2}', 'الهاتف البديل'],
  ['{city}', 'محافظة الوسيط'],
  ['{region}', 'منطقة الوسيط'],
  ['{address}', 'تفاصيل العنوان'],
  ['{landmark}', 'أقرب نقطة دالة'],
  ['{amount}', 'المبلغ المطلوب تحصيله'],
  ['{itemsCount}', 'عدد القطع'],
  ['{packageSize}', 'حجم الطرد'],
  ['{course}', 'اسم الدورة'],
  ['{receipt}', 'رقم الوصل'],
  ['{code}', 'كود الدورة'],
  ['{serial}', 'سيريال الكود'],
  ['{waseetQr}', 'رقم Waseet QR'],
] as const;

function readError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'فشل تنفيذ الطلب.');
  }
  return data as Record<string, unknown>;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [courses, setCourses] = useState<CourseType[]>([]);
  const [metadata, setMetadata] = useState<MetadataSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [newCourseName, setNewCourseName] = useState('');
  const [newCoursePrice, setNewCoursePrice] = useState('250');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPrice, setEditingPrice] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [settingsResponse, coursesResponse] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/course-types'),
      ]);
      const settingsData = await readJson(settingsResponse);
      const coursesData = await coursesResponse.json();
      if (!coursesResponse.ok) throw new Error(coursesData.error || 'تعذر تحميل الدورات.');

      setSettings({
        requestTemplate: String(settingsData.requestTemplate || ''),
        confirmationTemplate: String(settingsData.confirmationTemplate || ''),
        defaultOrderNote: String(settingsData.defaultOrderNote || ''),
      });
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    } catch (loadError) {
      setError(readError(loadError, 'تعذر تحميل الإعدادات.'));
    } finally {
      setLoading(false);
    }

    // Metadata is an external integration concern. Missing Waseet credentials or
    // temporary API downtime must not block local settings and course management.
    try {
      const metadataResponse = await fetch('/api/waseet/metadata');
      const metadataData = await readJson(metadataResponse);
      setMetadata({
        cities: Array.isArray(metadataData.cities) ? metadataData.cities.length : 0,
        regions: Array.isArray(metadataData.regions) ? metadataData.regions.length : 0,
        packageSizes: Array.isArray(metadataData.packageSizes) ? metadataData.packageSizes.length : 0,
        statuses: Array.isArray(metadataData.statuses) ? metadataData.statuses.length : 0,
      });
    } catch {
      setMetadata({ cities: 0, regions: 0, packageSizes: 0, statuses: 0 });
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      await readJson(response);
      setMessage('تم حفظ قوالب Waseet-native بنجاح.');
    } catch (saveError) {
      setError(readError(saveError, 'تعذر حفظ الإعدادات.'));
    } finally {
      setSaving(false);
    }
  }

  async function createCourse(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/course-types', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newCourseName.trim(), defaultPrice: Number(newCoursePrice) }),
      });
      const data = await readJson(response);
      setCourses(current => [...current, data.course as unknown as CourseType].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
      setNewCourseName('');
      setNewCoursePrice('250');
      setMessage('تمت إضافة الدورة.');
    } catch (courseError) {
      setError(readError(courseError, 'تعذرت إضافة الدورة.'));
    }
  }

  function startEditing(course: CourseType) {
    setEditingId(course.id);
    setEditingName(course.name);
    setEditingPrice(String(course.defaultPrice));
  }

  async function saveCourse(id: number) {
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/course-types', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, name: editingName.trim(), defaultPrice: Number(editingPrice) }),
      });
      const data = await readJson(response);
      const updated = data.course as unknown as CourseType;
      setCourses(current => current.map(course => course.id === id ? updated : course));
      setEditingId(null);
      setMessage('تم تحديث الدورة.');
    } catch (courseError) {
      setError(readError(courseError, 'تعذر تحديث الدورة.'));
    }
  }

  async function deleteCourse(id: number) {
    if (!window.confirm('سيُحذف نوع الدورة فقط إذا لم يكن مرتبطاً بطلبات أو أكواد. متابعة؟')) return;
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/course-types?id=${id}`, { method: 'DELETE' });
      await readJson(response);
      setCourses(current => current.filter(course => course.id !== id));
      setMessage('تم حذف الدورة.');
    } catch (courseError) {
      setError(readError(courseError, 'تعذر حذف الدورة.'));
    }
  }

  async function refreshMetadata() {
    setRefreshingMetadata(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/waseet/metadata?refresh=1', { method: 'POST' });
      const data = await readJson(response);
      setMetadata({
        cities: Array.isArray(data.cities) ? data.cities.length : 0,
        regions: Array.isArray(data.regions) ? data.regions.length : 0,
        packageSizes: Array.isArray(data.packageSizes) ? data.packageSizes.length : 0,
        statuses: Array.isArray(data.statuses) ? data.statuses.length : 0,
      });
      setMessage('تم تحديث المحافظات والمناطق والأحجام والحالات من الوسيط.');
    } catch (metadataError) {
      setError(readError(metadataError, 'تعذر تحديث قوائم الوسيط.'));
    } finally {
      setRefreshingMetadata(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-80 items-center justify-center gap-3 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" /> جاري تحميل الإعدادات...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8" dir="rtl">
      <header>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-white"><SettingsIcon className="h-6 w-6 text-swiss-lavender" /> إعدادات Course-sale + Waseet</h1>
        <p className="mt-2 text-sm text-zinc-400">لا توجد حالات شحن محلية قابلة للتعديل؛ رحلة الشحنة تُعرض من حالة الوسيط الحقيقية.</p>
      </header>

      {error ? <div className="flex gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div> : null}
      {message ? <div className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5 shrink-0" />{message}</div> : null}

      <section className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
        <form onSubmit={saveSettings} className="swiss-card space-y-5 rounded-xl p-5 md:p-6">
          <h2 className="flex items-center gap-2 border-b border-zinc-800 pb-4 text-sm font-bold text-white"><FileCode2 className="h-4 w-4 text-swiss-lavender" /> قوالب الطلب والتأكيد</h2>
          <label className="block space-y-2"><span className="text-xs font-bold text-zinc-300">رسالة طلب بيانات الطالب</span><textarea className="swiss-input min-h-44 w-full p-3 text-sm leading-7" value={settings?.requestTemplate || ''} onChange={event => setSettings(current => current ? { ...current, requestTemplate: event.target.value } : current)} /></label>
          <label className="block space-y-2"><span className="text-xs font-bold text-zinc-300">رسالة تأكيد الطلب</span><textarea className="swiss-input min-h-72 w-full p-3 font-mono text-xs leading-6" value={settings?.confirmationTemplate || ''} onChange={event => setSettings(current => current ? { ...current, confirmationTemplate: event.target.value } : current)} /></label>
          <label className="block space-y-2"><span className="text-xs font-bold text-zinc-300">ملاحظة افتراضية للمندوب</span><textarea className="swiss-input min-h-24 w-full p-3 text-sm" value={settings?.defaultOrderNote || ''} onChange={event => setSettings(current => current ? { ...current, defaultOrderNote: event.target.value } : current)} /></label>
          <button disabled={saving} className="swiss-btn-lavender flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ القوالب</button>
        </form>

        <div className="space-y-6">
          <div className="swiss-card space-y-4 rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Database className="h-4 w-4 text-swiss-lavender" /> قوائم الوسيط الرسمية</h2>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg border border-zinc-800 p-3"><strong className="block text-xl text-white">{metadata?.cities ?? 0}</strong><span className="text-zinc-500">محافظة</span></div>
              <div className="rounded-lg border border-zinc-800 p-3"><strong className="block text-xl text-white">{metadata?.regions ?? 0}</strong><span className="text-zinc-500">منطقة</span></div>
              <div className="rounded-lg border border-zinc-800 p-3"><strong className="block text-xl text-white">{metadata?.packageSizes ?? 0}</strong><span className="text-zinc-500">حجم طرد</span></div>
              <div className="rounded-lg border border-zinc-800 p-3"><strong className="block text-xl text-white">{metadata?.statuses ?? 0}</strong><span className="text-zinc-500">حالة Waseet</span></div>
            </div>
            <button onClick={() => void refreshMetadata()} disabled={refreshingMetadata} type="button" className="swiss-btn-neutral flex w-full items-center justify-center gap-2 px-4 py-2.5 text-xs disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshingMetadata ? 'animate-spin' : ''}`} /> تحديث من Waseet API</button>
          </div>

          <div className="swiss-card space-y-3 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white">متغيرات القالب المدعومة</h2>
            {PLACEHOLDERS.map(([key, label]) => <div key={key} className="flex items-center justify-between rounded border border-zinc-800 bg-black/20 px-3 py-2 text-xs"><span className="text-zinc-400">{label}</span><code className="text-swiss-lavender">{key}</code></div>)}
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-5 text-amber-200">أُزيلت متغيرات سعر التوصيل والسعر المحلي القديم. استخدم <code>{'{amount}'}</code> للمبلغ المطلوب تحصيله، وتأتي الأجور الفعلية من الوسيط.</p>
          </div>
        </div>
      </section>

      <section className="swiss-card space-y-5 rounded-xl p-5 md:p-6">
        <h2 className="text-sm font-bold text-white">أنواع الدورات والمبلغ الافتراضي</h2>
        <form onSubmit={createCourse} className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input required value={newCourseName} onChange={event => setNewCourseName(event.target.value)} className="swiss-input px-3 py-2.5 text-sm" placeholder="اسم الدورة" />
          <input required min={1} type="number" value={newCoursePrice} onChange={event => setNewCoursePrice(event.target.value)} className="swiss-input px-3 py-2.5 text-sm" placeholder="السعر بالآلاف" />
          <button className="swiss-btn-lavender flex items-center justify-center gap-2 px-4 py-2.5 text-sm"><Plus className="h-4 w-4" /> إضافة</button>
        </form>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[620px] text-right text-xs">
            <thead className="bg-zinc-900 text-zinc-400"><tr><th className="p-3">الدورة</th><th className="p-3">المبلغ الافتراضي بالآلاف</th><th className="p-3 text-center">الإجراءات</th></tr></thead>
            <tbody className="divide-y divide-zinc-800">
              {courses.map(course => <tr key={course.id}>
                <td className="p-3">{editingId === course.id ? <input className="swiss-input w-full px-2 py-1.5" value={editingName} onChange={event => setEditingName(event.target.value)} /> : <span className="font-bold text-white">{course.name}</span>}</td>
                <td className="p-3">{editingId === course.id ? <input type="number" min={1} className="swiss-input w-40 px-2 py-1.5" value={editingPrice} onChange={event => setEditingPrice(event.target.value)} /> : Number(course.defaultPrice).toLocaleString('ar-IQ')}</td>
                <td className="p-3"><div className="flex justify-center gap-2">{editingId === course.id ? <><button type="button" onClick={() => void saveCourse(course.id)} className="p-2 text-emerald-300" title="حفظ"><Check className="h-4 w-4" /></button><button type="button" onClick={() => setEditingId(null)} className="p-2 text-zinc-400" title="إلغاء"><X className="h-4 w-4" /></button></> : <><button type="button" onClick={() => startEditing(course)} className="p-2 text-swiss-lavender" title="تعديل"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void deleteCourse(course.id)} className="p-2 text-red-300" title="حذف"><Trash2 className="h-4 w-4" /></button></>}</div></td>
              </tr>)}
              {courses.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-zinc-500">لا توجد دورات.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
