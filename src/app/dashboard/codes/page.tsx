'use client';

import { useState, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Search, 
  Loader2, 
  AlertCircle,
  Upload,
  ArrowDownToLine,
  Tag,
  Trash2,
  Bookmark,
  X
} from 'lucide-react';

interface Code {
  id: string;
  codeValue: string;
  serialNumber: string;
  status: 'available' | 'used';
  courseTypeId: number | null;
  orderId: number | null;
  assignedAt: string | null;
  isDisabled: boolean;
}

interface User {
  id: string;
  username: string;
  role: 'admin' | 'agent';
}

const ITEMS_PER_PAGE = 15;

export default function CodeVaultPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [courseTypes, setCourseTypes] = useState<{ id: number; name: string }[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTab, setAddTab] = useState<'bulk' | 'single'>('bulk');
  const [rawText, setRawText] = useState('');
  const [selectedCourseTypeId, setSelectedCourseTypeId] = useState<string>('');
  
  // Single Add States
  const [singleCode, setSingleCode] = useState('');
  const [singleSerial, setSingleSerial] = useState('');
  const [singleCourseTypeId, setSingleCourseTypeId] = useState('');

  // Barcode Scanner States
  const [showScanner, setShowScanner] = useState(false);
  const [scannerInstance, setScannerInstance] = useState<any>(null);

  // Inline Edit States
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editCourseTypeId, setEditCourseTypeId] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // PIN Protection States
  const [pinInput, setPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '3101') {
      setIsUnlocked(true);
      setPinError('');
    } else {
      setPinError('رمز الحماية غير صحيح. يرجى المحاولة مرة أخرى.');
      setPinInput('');
    }
  };

  async function loadData() {
    try {
      const [meRes, codesRes, courseTypesRes, ordersRes, statusesRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/codes'),
        fetch('/api/course-types'),
        fetch('/api/orders'),
        fetch('/api/statuses')
      ]);
      
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user);
      }
      
      if (codesRes.ok) {
        const codesData = await codesRes.json();
        setCodes(codesData);
      } else {
        setError('فشل في جلب كودات الدورات');
      }

      if (courseTypesRes.ok) {
        const ctData = await courseTypesRes.json();
        setCourseTypes(ctData);
        if (ctData.length > 0) {
          setSelectedCourseTypeId(ctData[0].id.toString());
          setSingleCourseTypeId(ctData[0].id.toString());
        }
      }

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData);
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

  useEffect(() => {
    loadData();
  }, []);

  const startScanner = async () => {
    setShowScanner(true);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const html5QrCode = new Html5Qrcode("qr-reader");
        setScannerInstance(html5QrCode);
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 }
          },
          (decodedText) => {
            setSingleSerial(decodedText);
            html5QrCode.stop().then(() => {
              setShowScanner(false);
            }).catch(err => console.error(err));
          },
          (errorMessage) => {}
        );
      } catch (err) {
        console.error("Failed to start scanner:", err);
        alert("فشل في تشغيل الكاميرا. تأكد من إعطاء الصلاحيات.");
        setShowScanner(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerInstance) {
      try {
        await scannerInstance.stop();
      } catch (err) {
        console.error(err);
      }
      setScannerInstance(null);
    }
    setShowScanner(false);
  };

  const handleSingleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploadMessage('');

    if (!singleCode.trim()) {
      setError('يرجى إدخال رمز كود التفعيل');
      return;
    }
    if (!singleSerial.trim()) {
      setError('يرجى إدخال الرقم التسلسلي');
      return;
    }
    if (!singleCourseTypeId) {
      setError('الرجاء تحديد نوع الدورة');
      return;
    }

    setIsUploading(true);
    try {
      const res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: `${singleCode.trim()},${singleSerial.trim()}`,
          courseTypeId: Number(singleCourseTypeId)
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إضافة الكود');
      }

      setUploadMessage(data.message);
      setSingleCode('');
      setSingleSerial('');
      await loadData();
      setTimeout(() => setShowAddForm(false), 2000);
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartInlineEdit = (code: Code) => {
    setEditingCodeId(code.id);
    setEditCodeValue(code.codeValue);
    setEditSerialNumber(code.serialNumber);
    setEditCourseTypeId(code.courseTypeId?.toString() || '');
  };

  const handleCancelInlineEdit = () => {
    setEditingCodeId(null);
    setEditCodeValue('');
    setEditSerialNumber('');
    setEditCourseTypeId('');
  };

  const handleSaveInlineEdit = async (id: string) => {
    if (!editCodeValue.trim() || !editSerialNumber.trim()) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    try {
      const res = await fetch('/api/codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          codeValue: editCodeValue.trim(),
          serialNumber: editSerialNumber.trim(),
          courseTypeId: Number(editCourseTypeId)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث الكود');
      }
      setCodes(prev => prev.map(c => c.id === id ? data.code : c));
      setEditingCodeId(null);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ التعديل');
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploadMessage('');

    if (!rawText.trim()) {
      setError('يرجى إدخال نص الكودات أولاً');
      return;
    }
    if (!selectedCourseTypeId) {
      setError('الرجاء تحديد نوع الدورة للكودات المستوردة');
      return;
    }

    setIsUploading(true);
    try {
      const res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, courseTypeId: Number(selectedCourseTypeId) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء شحن المخزن');
      }

      setUploadMessage(data.message);
      setRawText('');
      await loadData();
      setTimeout(() => setShowAddForm(false), 2000);
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكود نهائياً من المخزن؟')) {
      return;
    }

    try {
      const res = await fetch(`/api/codes?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف الكود');
      }

      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حذف الكود');
    }
  };

  const handleToggleDisable = async (id: string) => {
    try {
      const res = await fetch('/api/codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggleDisabled' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تعديل حالة الكود');
      }

      setCodes(prev => prev.map(c => c.id === id ? { ...c, isDisabled: data.isDisabled } : c));
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تعديل الكود');
    }
  };

  const totalCodes = codes.length;
  const availableCodes = codes.filter(c => c.status === 'available').length;
  const usedCodes = codes.filter(c => c.status === 'used').length;

  const filteredCodes = codes.filter(c => {
    const matchSearch = 
      c.codeValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.orderId && c.orderId.toString().includes(searchQuery));

    const matchStatus = statusFilter === '' || c.status === statusFilter;
    const matchCourse = courseFilter === '' || (c.courseTypeId && c.courseTypeId.toString() === courseFilter);

    return matchSearch && matchStatus && matchCourse;
  });

  const totalPages = Math.ceil(filteredCodes.length / ITEMS_PER_PAGE) || 1;
  const paginatedCodes = filteredCodes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, courseFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-swiss-lavender" />
        <span className="text-sm font-semibold">جاري تحميل كودات المخزن...</span>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 select-none">
        <div className="w-full max-w-md bg-[#0c0c0e] border border-zinc-800/80 rounded-lg p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-swiss-lavender/10 border border-swiss-lavender/20 mb-2">
            <Database className="w-5 h-5 text-swiss-lavender" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">مخزن الكودات محمي</h3>
            <p className="text-xs text-zinc-400">يرجى إدخال رمز الحماية المكون من 4 أرقام للوصول إلى بيانات المخزن.</p>
          </div>
          
          <form onSubmit={handleVerifyPin} className="space-y-4">
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setPinInput(val);
              }}
              className="w-32 text-center py-3 bg-zinc-950 border border-zinc-800 rounded font-mono text-2xl font-bold tracking-[0.75em] pl-[0.75em] text-white focus:outline-none focus:border-swiss-lavender focus:ring-1 focus:ring-swiss-lavender transition-all"
              placeholder="••••"
              autoFocus
            />
            {pinError && (
              <p className="text-[11px] text-red-400 font-bold">{pinError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 swiss-btn-lavender text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء القفل
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none px-4 py-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Database className="w-6 h-6 text-swiss-lavender" />
            <span>مخزن كودات الدورات</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            مراقبة التوزيع، شحن المخزن بالكودات الجديدة، والبحث بالرقم المتسلسل وربط الحجوزات.
          </p>
        </div>

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-5 py-2.5 swiss-btn-lavender flex items-center justify-center gap-2 cursor-pointer text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>شحن الكودات</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total Codes */}
        <div className="swiss-panel p-5 rounded-lg relative overflow-hidden flex items-center gap-4 border border-zinc-800">
          <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
            <Tag className="w-4 h-4 text-swiss-lavender" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">إجمالي كودات المخزن</span>
            <span className="font-mono text-xl font-bold text-zinc-100">{totalCodes}</span>
          </div>
        </div>

        {/* Available Codes */}
        <div className="swiss-panel p-5 rounded-lg relative overflow-hidden flex items-center gap-4 border border-zinc-800">
          <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">الكودات الصالحة المتاحة</span>
            <span className="font-mono text-xl font-bold text-emerald-400">{availableCodes}</span>
          </div>
        </div>

        {/* Used Codes */}
        <div className="swiss-panel p-5 rounded-lg relative overflow-hidden flex items-center gap-4 border border-zinc-800">
          <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
            <XCircle className="w-4 h-4 text-swiss-lavender" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">الكودات المستعملة المباعة</span>
            <span className="font-mono text-xl font-bold text-swiss-lavender">{usedCodes}</span>
          </div>
        </div>

      </div>

      {/* Bulk Add Form Panel */}
      {showAddForm && currentUser?.role === 'admin' && (
        <div className="swiss-panel rounded-lg p-6 space-y-4 border border-zinc-800 animate-fadeIn">
          {/* Tab Selector */}
          <div className="flex border-b border-zinc-800 pb-3 justify-between items-center">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setAddTab('bulk')}
                className={`pb-2 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  addTab === 'bulk'
                    ? 'text-swiss-lavender border-swiss-lavender'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                شحن بالجملة (Bulk)
              </button>
              <button
                type="button"
                onClick={() => setAddTab('single')}
                className={`pb-2 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  addTab === 'single'
                    ? 'text-swiss-lavender border-swiss-lavender'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                إضافة فردية (Single)
              </button>
            </div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">متاح للمشرف فقط</span>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800 text-red-300 text-xs font-bold rounded-lg">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {uploadMessage && (
            <div className="flex items-center gap-3 p-4 bg-emerald-950/20 border border-emerald-800 text-emerald-300 text-xs font-bold rounded-lg">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{uploadMessage}</span>
            </div>
          )}

          {addTab === 'bulk' ? (
            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-xs font-bold text-zinc-300">
                    أدخل الكودات هنا (كل سطر يمثل كود منفرد)
                  </label>
                  <textarea
                    className="w-full h-48 swiss-input p-4 text-xs font-mono resize-none text-left"
                    dir="ltr"
                    placeholder={`أمثلة على الصيغ المقبولة:\nCODE123\nCODE123,SERIAL456\nCODE123;SERIAL456\nCODE123   SERIAL456`}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    disabled={isUploading}
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-300">
                      ربط الكودات بنوع الدورة <span className="text-swiss-lavender font-bold">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 swiss-input text-xs font-bold bg-zinc-950"
                      value={selectedCourseTypeId}
                      onChange={(e) => setSelectedCourseTypeId(e.target.value)}
                      disabled={isUploading}
                    >
                      <option value="">اختر الدورة التدريبية...</option>
                      {courseTypes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-zinc-950/40 p-4 border border-zinc-805 rounded text-[10px] text-zinc-500 font-semibold leading-relaxed">
                    تأكد من مطابقة الكودات المستوردة لنوع الدورة المحددة. لا يمكن تحويل الكود لدورة أخرى بعد ربطه وتثبيته.
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-end border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 swiss-btn-neutral text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 swiss-btn-lavender text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <ArrowDownToLine className="w-4 h-4 text-zinc-950" />}
                  <span>رفع الكودات للمخزن</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSingleAdd} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-300">
                      رمز كود التفعيل <span className="text-swiss-lavender font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 swiss-input text-xs font-mono text-left"
                      dir="ltr"
                      placeholder="رمز الكود (مثال: CH-99382)"
                      value={singleCode}
                      onChange={(e) => setSingleCode(e.target.value)}
                      disabled={isUploading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-300">
                      الرقم التسلسلي (Serial Number) <span className="text-swiss-lavender font-bold">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 swiss-input text-xs font-mono text-left"
                        dir="ltr"
                        placeholder="الرقم التسلسلي (مثال: SN-88299)"
                        value={singleSerial}
                        onChange={(e) => setSingleSerial(e.target.value)}
                        disabled={isUploading}
                      />
                      <button
                        type="button"
                        onClick={startScanner}
                        className="px-4 py-2 swiss-btn-neutral text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <span>مسح الكاميرا</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-300">
                      نوع الدورة المرتبطة <span className="text-swiss-lavender font-bold">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 swiss-input text-xs font-bold bg-zinc-950"
                      value={singleCourseTypeId}
                      onChange={(e) => setSingleCourseTypeId(e.target.value)}
                      disabled={isUploading}
                    >
                      <option value="">اختر الدورة التدريبية...</option>
                      {courseTypes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-end border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 swiss-btn-neutral text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 swiss-btn-lavender text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <Plus className="w-4 h-4 text-zinc-950" />}
                  <span>إضافة الكود</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Search and filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Search */}
        <div className="md:col-span-6 relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            className="w-full pr-10 pl-4 py-2.5 swiss-input text-xs font-semibold"
            placeholder="البحث بقيمة الكود، السيريال، أو رقم الطلب المرفق..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Course Filter */}
        <div className="md:col-span-3 relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
            <Bookmark className="w-4 h-4" />
          </div>
          <select
            className="w-full pr-10 pl-4 py-2.5 swiss-input text-xs font-semibold appearance-none bg-[#0c0c0e]"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">كل الدورات</option>
            {courseTypes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="md:col-span-3 relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
            <Database className="w-4 h-4" />
          </div>
          <select
            className="w-full pr-10 pl-4 py-2.5 swiss-input text-xs font-semibold appearance-none bg-[#0c0c0e]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">كل الحالات</option>
            <option value="available">متاح فقط (غير مستخدم)</option>
            <option value="used">مستعمل فقط (مباع)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="swiss-panel rounded-lg overflow-hidden border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-900/40 border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider select-none">
                <th className="py-4 px-6 border-l border-zinc-800/60">رمز كود التفعيل</th>
                <th className="py-4 px-6 text-center border-l border-zinc-800/60">الرقم التسلسلي (Serial)</th>
                <th className="py-4 px-6 text-center border-l border-zinc-800/60 font-bold text-swiss-lavender">نوع الدورة المرتبطة</th>
                <th className="py-4 px-6 text-center border-l border-zinc-800/60">حالة التوفر</th>
                <th className="py-4 px-6 text-center border-l border-zinc-800/60">ارتباط الحجز (Clickable)</th>
                <th className="py-4 px-6 text-center border-l border-zinc-800/60">تاريخ الاستهلاك</th>
                {currentUser?.role === 'admin' && <th className="py-4 px-6 text-center">إجراء</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs font-semibold">
              {paginatedCodes.length === 0 ? (
                <tr>
                  <td colSpan={currentUser?.role === 'admin' ? 7 : 6} className="py-12 text-center text-zinc-500 font-semibold">
                    لا توجد أي كودات تفعيل مطابقة لمدخلات البحث.
                  </td>
                </tr>
              ) : (
                paginatedCodes.map((code) => {
                  const isEditing = editingCodeId === code.id;
                  const courseName = courseTypes.find(ct => ct.id === code.courseTypeId)?.name || 'دورة الأحياء';
                  const matchedOrder = orders.find(o => o.id === code.orderId);
                  const receiptNum = matchedOrder ? matchedOrder.receiptNumber : code.orderId;

                  return (
                    <tr key={code.id} className="hover:bg-zinc-900/10 transition-colors">
                      <td className="py-3 px-6 border-l border-zinc-800/40">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCodeValue}
                            onChange={(e) => setEditCodeValue(e.target.value)}
                            className="w-full px-2 py-1 swiss-input text-xs font-mono text-left font-bold"
                            dir="ltr"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-200 select-all">{code.codeValue}</span>
                            {code.status === 'used' && matchedOrder && (statuses.find(s => s.id === matchedOrder.statusId)?.name === 'راجع' || matchedOrder.statusId === 4) && (
                              <span className="px-1.5 py-0.5 rounded bg-red-950/20 text-red-400 border border-red-800/30 text-[9px] font-bold">
                                (راجع)
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-6 text-center border-l border-zinc-800/40">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editSerialNumber}
                            onChange={(e) => setEditSerialNumber(e.target.value)}
                            className="w-full px-2 py-1 swiss-input text-xs font-mono text-left"
                            dir="ltr"
                          />
                        ) : (
                          <span className="font-mono text-zinc-400 select-all">{code.serialNumber}</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-center border-l border-zinc-800/40">
                        {isEditing ? (
                          <select
                            value={editCourseTypeId}
                            onChange={(e) => setEditCourseTypeId(e.target.value)}
                            className="w-full px-2 py-1 swiss-input text-xs font-bold bg-zinc-950"
                          >
                            {courseTypes.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-zinc-300">{courseName}</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center border-l border-zinc-800/40">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                            code.status === 'available'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-swiss-lavender/10 text-swiss-lavender border-swiss-lavender/25'
                          }`}>
                            {code.status === 'available' ? 'متاح وصالح' : 'مستهلك'}
                          </span>
                          {code.isDisabled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold bg-zinc-800 text-zinc-400 border-zinc-700/80">
                              معطل
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center border-l border-zinc-800/40">
                        {code.status === 'used' && matchedOrder ? (
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(matchedOrder)}
                            className="font-bold text-swiss-lavender bg-zinc-950 border border-zinc-800 hover:border-swiss-lavender px-3 py-1.5 rounded font-mono text-[10px] cursor-pointer transition-all hover:bg-zinc-900"
                          >
                            وصل #{receiptNum}
                          </button>
                        ) : code.status === 'used' ? (
                          <span className="font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded font-mono text-[10px]">
                            طلب #{code.orderId}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-zinc-500 text-center text-xs font-mono border-l border-zinc-800/40">
                        {code.assignedAt ? new Date(code.assignedAt).toLocaleString('ar-IQ') : '—'}
                      </td>
                      {currentUser?.role === 'admin' && (
                        <td className="py-3 px-6 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveInlineEdit(code.id)}
                                className="text-[10px] font-bold px-3 py-1 rounded bg-swiss-lavender text-zinc-950 hover:bg-swiss-lavender-hover transition-all cursor-pointer"
                              >
                                حفظ
                              </button>
                              <button
                                onClick={handleCancelInlineEdit}
                                className="text-[10px] font-bold px-3 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-all cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleStartInlineEdit(code)}
                                className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-950 text-swiss-lavender border border-zinc-800 hover:border-swiss-lavender/30 transition-all cursor-pointer"
                              >
                                تعديل
                              </button>
                              <button
                                onClick={() => handleToggleDisable(code.id)}
                                className={`text-[10px] font-bold px-2 py-1 rounded border transition-all cursor-pointer ${
                                  code.isDisabled
                                    ? 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700'
                                    : 'bg-zinc-950 text-amber-500 border-zinc-800 hover:border-amber-500/30'
                                }`}
                              >
                                {code.isDisabled ? 'تفعيل' : 'تعطيل'}
                              </button>
                              <button
                                onClick={() => handleDeleteCode(code.id)}
                                className="p-1.5 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                title="حذف الكود"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {filteredCodes.length > 0 && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-zinc-400">
              الصفحة {currentPage} من {totalPages} ({filteredCodes.length} كود تفعيل)
            </span>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 swiss-btn-neutral disabled:opacity-35 disabled:pointer-events-none"
              >
                السابق
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 swiss-btn-neutral disabled:opacity-35 disabled:pointer-events-none"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal (Swiss Minimalist Dialog) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 p-6 rounded-lg animate-zoomIn space-y-6 text-right select-none">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-swiss-lavender" />
                <span>تفاصيل حجز الطالب (وصل #{selectedOrder.receiptNumber})</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
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
                <span className="text-[10px] text-zinc-500 block mb-1">المبلغ الإجمالي</span>
                <span className="text-emerald-400 font-mono text-sm font-bold">{(selectedOrder.totalPrice * 1000).toLocaleString()} د.ع</span>
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
              <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                <span className="text-[10px] text-zinc-500 block mb-1">كود التفعيل الممنوح</span>
                <span className="text-swiss-lavender font-mono font-bold text-sm select-all">{selectedOrder.StudentVaultCode_ID}</span>
              </div>
              <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded">
                <span className="text-[10px] text-zinc-500 block mb-1">الرقم التسلسلي (Serial)</span>
                <span className="text-zinc-200 font-mono font-bold text-sm select-all">{selectedOrder.StudentVaultCode_Serial}</span>
              </div>
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
            </div>

            {/* Actions */}
            <div className="border-t border-zinc-800 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2.5 swiss-btn-neutral text-xs cursor-pointer font-bold"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 rounded-lg space-y-6 text-right select-none animate-zoomIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>ماسح باركود الكاميرا</span>
              </h3>
              <button
                type="button"
                onClick={stopScanner}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-square bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden flex items-center justify-center">
              {/* Scanner container for html5-qrcode */}
              <div id="qr-reader" className="w-full h-full"></div>
              
              {/* Laser Line Overlay */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between">
                <div className="absolute left-[10%] right-[10%] top-[30%] bottom-[30%] border-2 border-dashed border-swiss-lavender/50 rounded pointer-events-none">
                  {/* The laser line */}
                  <div className="w-full h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-laserLine absolute top-0"></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={stopScanner}
                className="px-6 py-2.5 swiss-btn-neutral text-xs cursor-pointer font-bold"
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
