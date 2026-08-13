'use client';

import { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FileCode,
  Info,
  Bookmark,
  Plus,
  Trash2
} from 'lucide-react';

interface Settings {
  requestTemplate: string;
  confirmationTemplate: string;
  defaultOrderNote: string;
}

interface CourseType {
  id: number;
  name: string;
  defaultPrice: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // New Course Type state
  const [newCourseName, setNewCourseName] = useState('');
  const [newCoursePrice, setNewCoursePrice] = useState('250');
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [courseError, setCourseError] = useState('');

  // Course Type Inline Edit state
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCoursePrice, setEditCoursePrice] = useState('');

  // New Status state
  const [newStatusName, setNewStatusName] = useState('');
  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  async function loadData() {
    try {
      const [settingsRes, courseTypesRes, statusesRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/course-types'),
        fetch('/api/statuses')
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      } else {
        setError('فشل في تحميل الإعدادات');
      }

      if (courseTypesRes.ok) {
        const data = await courseTypesRes.json();
        setCourseTypes(data);
      }

      if (statusesRes.ok) {
        const data = await statusesRes.json();
        setStatuses(data);
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    
    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء حفظ التعديلات');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleAddCourseType = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseError('');
    const name = newCourseName.trim();
    const price = parseInt(newCoursePrice, 10);

    if (!name) {
      setCourseError('الرجاء إدخال اسم الدورة');
      return;
    }
    if (isNaN(price) || price <= 0) {
      setCourseError('الرجاء إدخال سعر افتراضي صالح بالآلاف');
      return;
    }

    setIsAddingCourse(true);
    try {
      const res = await fetch('/api/course-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, defaultPrice: price }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إضافة الدورة');
      }

      setCourseTypes(prev => [...prev, data.course]);
      setNewCourseName('');
      setNewCoursePrice('250');
    } catch (err: any) {
      setCourseError(err.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsAddingCourse(false);
    }
  };

  const handleStartCourseEdit = (course: CourseType) => {
    setEditingCourseId(course.id);
    setEditCourseName(course.name);
    setEditCoursePrice(course.defaultPrice.toString());
  };

  const handleCancelCourseEdit = () => {
    setEditingCourseId(null);
    setEditCourseName('');
    setEditCoursePrice('');
  };

  const handleSaveCourseEdit = async (id: number) => {
    const name = editCourseName.trim();
    const price = parseInt(editCoursePrice, 10);

    if (!name) {
      alert('الرجاء إدخال اسم الدورة');
      return;
    }
    if (isNaN(price) || price <= 0) {
      alert('الرجاء إدخال سعر افتراضي صالح');
      return;
    }

    try {
      const res = await fetch('/api/course-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, defaultPrice: price }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث الدورة');
      }

      setCourseTypes(prev => prev.map(c => c.id === id ? data.course : c));
      setEditingCourseId(null);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ في الاتصال بالخادم');
    }
  };

  const handleDeleteCourseType = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف نوع الدورة هذا؟ قد يؤدي هذا إلى عدم إمكانية سحب الكودات الخاصة به تلقائياً.')) {
      return;
    }

    setCourseError('');
    try {
      const res = await fetch(`/api/course-types?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف الدورة');
      }

      setCourseTypes(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      setCourseError(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleAddStatusType = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError('');
    const name = newStatusName.trim();

    if (!name) {
      setStatusError('الرجاء إدخال اسم الحالة');
      return;
    }

    setIsAddingStatus(true);
    try {
      const res = await fetch('/api/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إضافة الحالة');
      }

      setStatuses(prev => [...prev, data.status]);
      setNewStatusName('');
    } catch (err: any) {
      setStatusError(err.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsAddingStatus(false);
    }
  };

  const handleDeleteStatusType = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف حالة الطلب هذه؟ سيؤثر هذا على الطلبات التي تحمل نفس الحالة.')) {
      return;
    }

    setStatusError('');
    try {
      const res = await fetch(`/api/statuses?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف الحالة');
      }

      setStatuses(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      setStatusError(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-swiss-lavender" />
        <span className="text-sm font-semibold">جاري تحميل الإعدادات...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none px-4 py-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-swiss-lavender" />
          <span>إعدادات النظام والقوالب الديناميكية</span>
        </h2>
        <p className="text-zinc-400 text-sm mt-1">
          تعديل وصيانة رسائل التنسيق والردود التلقائية لعملاء المبيعات، وإدارة أنواع الدورات التدريبية المتاحة.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Editor Forms (8 Cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="swiss-panel rounded-lg p-6 space-y-6 border border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-200 border-b border-zinc-800 pb-3 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-swiss-lavender" />
                <span>تعديل نصوص القوالب</span>
              </h3>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800 text-red-300 text-xs font-bold rounded-lg">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-3 p-4 bg-emerald-950/20 border border-emerald-800 text-emerald-300 text-xs font-bold rounded-lg">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span>تم حفظ التغييرات وتحديث القوالب في قاعدة البيانات!</span>
                </div>
              )}

              {/* Template 1 */}
              <div className="space-y-2">
                <label htmlFor="requestTemplate" className="block text-xs font-bold text-zinc-300">
                  1. نموذج طلب المعلومات (البيانات المطلوبة من الطالب)
                </label>
                <textarea
                  id="requestTemplate"
                  name="requestTemplate"
                  value={settings?.requestTemplate}
                  onChange={handleChange}
                  className="w-full h-40 swiss-input p-4 text-xs font-semibold leading-relaxed"
                  placeholder="اسم الطالب، الهاتف، المحافظة..."
                />
              </div>

              {/* Template 2 */}
              <div className="space-y-2">
                <label htmlFor="confirmationTemplate" className="block text-xs font-bold text-zinc-300">
                  2. رسالة تأكيد تثبيت الحجز (المكتملة)
                </label>
                <textarea
                  id="confirmationTemplate"
                  name="confirmationTemplate"
                  value={settings?.confirmationTemplate}
                  onChange={handleChange}
                  className="w-full h-72 swiss-input p-4 text-xs font-mono leading-relaxed"
                  placeholder="رسالة التأكيد النهائية مع كود التفعيل والأسعار..."
                />
              </div>

              {/* Default Order Note */}
              <div className="space-y-2">
                <label htmlFor="defaultOrderNote" className="block text-xs font-bold text-zinc-300">
                  3. ملاحظات ثابتة تلقائية (تظهر تلقائياً عند إضافة طلب جديد)
                </label>
                <textarea
                  id="defaultOrderNote"
                  name="defaultOrderNote"
                  value={settings?.defaultOrderNote || ''}
                  onChange={handleChange}
                  className="w-full h-24 swiss-input p-4 text-xs font-semibold leading-relaxed"
                  placeholder="أدخل ملاحظة افتراضية ثابتة هنا (مثال: يرجى الاتصال قبل التوصيل)..."
                />
              </div>

              <div className="border-t border-zinc-800 pt-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-2.5 swiss-btn-lavender text-xs flex items-center justify-center gap-2 cursor-pointer font-bold"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <Save className="w-4 h-4 text-zinc-950" />}
                  <span>حفظ القوالب الجديدة</span>
                </button>
              </div>
            </div>
          </form>

          {/* Course Types Manager Panel */}
          <div className="swiss-panel rounded-lg p-6 space-y-6 border border-zinc-800">
            <h3 className="font-bold text-sm text-zinc-200 border-b border-zinc-800 pb-3 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-swiss-lavender" />
              <span>إدارة أنواع الدورات وأسعارها الافتراضية</span>
            </h3>

            {courseError && (
              <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800 text-red-300 text-xs font-bold rounded-lg">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{courseError}</span>
              </div>
            )}

            {/* Add Course Type Form */}
            <form onSubmit={handleAddCourseType} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-950/40 p-4 border border-zinc-800 rounded-lg">
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">اسم الدورة</label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                  placeholder="مثال: دورة الكيمياء"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">السعر الافتراضي بالآلاف (مثال: 250)</label>
                <input
                  type="number"
                  required
                  value={newCoursePrice}
                  onChange={(e) => setNewCoursePrice(e.target.value)}
                  className="w-full px-3 py-2 swiss-input text-xs font-mono font-semibold"
                  placeholder="250"
                />
              </div>
              <div className="flex items-end sm:col-span-1">
                <button
                  type="submit"
                  disabled={isAddingCourse}
                  className="w-full py-2 swiss-btn-lavender text-xs flex items-center justify-center gap-2 cursor-pointer font-bold h-[38px]"
                >
                  {isAddingCourse ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <Plus className="w-4 h-4 text-zinc-950" />}
                  <span>حفظ الدورة</span>
                </button>
              </div>
            </form>

            {/* Course Types Table */}
            <div className="border border-zinc-800 rounded overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-zinc-900/40 border-b border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider select-none">
                    <th className="py-2.5 px-4 border-l border-zinc-800/60">اسم الدورة التدريبية</th>
                    <th className="py-2.5 px-4 text-center border-l border-zinc-800/60 w-40">السعر الافتراضي (بالآلاف)</th>
                    <th className="py-2.5 px-4 text-center border-l border-zinc-800/60 w-40">السعر الفعلي</th>
                    <th className="py-2.5 px-4 text-center w-20">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs font-semibold text-zinc-200">
                  {courseTypes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500 font-semibold">
                        لم يتم العثور على أي دورات تدريبية مضافة بعد.
                      </td>
                    </tr>
                  ) : (
                    courseTypes.map(c => {
                      const isEditing = editingCourseId === c.id;
                      return (
                        <tr key={c.id} className="hover:bg-zinc-900/10 transition-colors">
                          <td className="py-2.5 px-4 border-l border-zinc-800/40 font-bold">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editCourseName}
                                onChange={(e) => setEditCourseName(e.target.value)}
                                className="w-full px-2 py-1 swiss-input text-xs font-bold"
                              />
                            ) : (
                              c.name
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center border-l border-zinc-800/40 font-mono text-zinc-400">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editCoursePrice}
                                onChange={(e) => setEditCoursePrice(e.target.value)}
                                className="w-full px-2 py-1 swiss-input text-xs font-mono text-center"
                              />
                            ) : (
                              c.defaultPrice
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center border-l border-zinc-800/40 font-mono text-swiss-lavender">
                            {isEditing ? (
                              <span>{(Number(editCoursePrice || 0) * 1000).toLocaleString()} د.ع</span>
                            ) : (
                              <span>{(c.defaultPrice * 1000).toLocaleString()} د.ع</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSaveCourseEdit(c.id)}
                                  className="text-[10px] font-bold px-2 py-1 rounded bg-swiss-lavender text-zinc-950 hover:bg-swiss-lavender-hover transition-all cursor-pointer"
                                >
                                  حفظ
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelCourseEdit}
                                  className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-all cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartCourseEdit(c)}
                                  className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-950 text-swiss-lavender border border-zinc-800 hover:border-swiss-lavender/30 transition-all cursor-pointer"
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCourseType(c.id)}
                                  className="p-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                  title="حذف نوع الدورة"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* Order Statuses Manager Panel */}
          <div className="swiss-panel rounded-lg p-6 space-y-6 border border-zinc-800">
            <h3 className="font-bold text-sm text-zinc-200 border-b border-zinc-800 pb-3 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-swiss-lavender" />
              <span>إدارة حالات الطلبات الديناميكية</span>
            </h3>

            {statusError && (
              <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800 text-red-300 text-xs font-bold rounded-lg">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            {/* Add Status Type Form */}
            <form onSubmit={handleAddStatusType} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-950/40 p-4 border border-zinc-800 rounded-lg">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">اسم حالة الطلب</label>
                <input
                  type="text"
                  required
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  className="w-full px-3 py-2 swiss-input text-xs font-semibold"
                  placeholder="مثال: قيد الانتظار"
                />
              </div>
              <div className="flex items-end sm:col-span-1">
                <button
                  type="submit"
                  disabled={isAddingStatus}
                  className="w-full py-2 swiss-btn-lavender text-xs flex items-center justify-center gap-2 cursor-pointer font-bold h-[38px]"
                >
                  {isAddingStatus ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <Plus className="w-4 h-4 text-zinc-950" />}
                  <span>حفظ الحالة</span>
                </button>
              </div>
            </form>

            {/* Statuses Table */}
            <div className="border border-zinc-800 rounded overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-zinc-900/40 border-b border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider select-none">
                    <th className="py-2.5 px-4 border-l border-zinc-800/60">الحالة</th>
                    <th className="py-2.5 px-4 text-center border-l border-zinc-800/60 w-32">المعرف (ID)</th>
                    <th className="py-2.5 px-4 text-center w-20">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs font-semibold text-zinc-200">
                  {statuses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-500 font-semibold">
                        لم يتم العثور على أي حالات مضافة بعد.
                      </td>
                    </tr>
                  ) : (
                    statuses.map(s => (
                      <tr key={s.id} className="hover:bg-zinc-900/10 transition-colors">
                        <td className="py-3 px-4 border-l border-zinc-800/40 font-bold">
                          {s.name}
                          {[1, 2, 3, 4].includes(s.id) && (
                            <span className="text-[10px] text-zinc-500 mr-2 font-normal">(حالة افتراضية للنظام)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center border-l border-zinc-800/40 font-mono text-zinc-400">{s.id}</td>
                        <td className="py-3 px-4 text-center">
                          {![1, 2, 3, 4].includes(s.id) ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteStatusType(s.id)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              title="حذف حالة الطلب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-normal">غير قابل للحذف</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
        
        {/* Right Column: Placeholders Helper Guide (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="swiss-card rounded-lg p-5 space-y-4 border border-zinc-800">
            <h4 className="font-bold text-sm text-zinc-200 flex items-center gap-2 border-b border-zinc-800 pb-2">
              <Info className="w-4 h-4 text-swiss-lavender" />
              <span>المتغيرات المدعومة</span>
            </h4>
            <p className="text-[10px] text-zinc-400 font-semibold leading-relaxed">
              تأكد من كتابة المتغيرات بدقة وبنفس التنسيق داخل الأقواس الحاصرة ليتم استبدالها تلقائياً عند إصدار رسالة التثبيت:
            </p>

            <div className="space-y-2 text-xs">
              
              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">اسم الطالب</span>
                <span className="text-swiss-lavender font-bold">{"{{StudentName}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">نوع الدورة (Course Type)</span>
                <span className="text-swiss-lavender font-bold">{"{{CourseName}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">رقم الهاتف الأساسي</span>
                <span className="text-swiss-lavender font-bold">{"{{Phone1}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">رقم الهاتف البديل</span>
                <span className="text-swiss-lavender font-bold">{"{{Phone2}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">المحافظة</span>
                <span className="text-swiss-lavender font-bold">{"{{Province}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">العنوان التفصيلي</span>
                <span className="text-swiss-lavender font-bold">{"{{Address}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">أقرب نقطة دالة</span>
                <span className="text-swiss-lavender font-bold">{"{{Landmark}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">كود الدورة المولد</span>
                <span className="text-swiss-lavender font-bold">{"{{Code}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">سيريال الكود</span>
                <span className="text-swiss-lavender font-bold">{"{{Serial}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">سعر الدورة (المبلغ - 5000)</span>
                <span className="text-swiss-lavender font-bold">{"{{Price}}"}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/40 border border-zinc-800/80 rounded font-mono">
                <span className="text-zinc-400 font-bold">المبلغ الكلي مع التوصيل</span>
                <span className="text-swiss-lavender font-bold">{"{{TotalPrice}}"}</span>
              </div>

            </div>
            
            <div className="bg-swiss-lavender/10 border border-swiss-lavender/20 p-3.5 text-[10px] text-swiss-lavender font-bold leading-relaxed rounded-md">
              ملاحظة: يمكنك إدراج أي متغير في القالب وتنسيق الرسالة بحرية تامة دون التعديل على الكود المصدري للمشروع. يدعم النظام كلاً من التنسيق {"{{Var}}"} والتنسيق القديم {"{var}"} للتوافقية الكاملة.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
