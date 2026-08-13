'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  ShieldAlert, 
  UserPlus, 
  Key, 
  Check, 
  AlertCircle, 
  Loader2,
  Lock,
  UserCheck
} from 'lucide-react';

interface Agent {
  id: string;
  username: string;
  role: 'admin' | 'agent';
  createdAt: string;
}

interface UserSession {
  id: string;
  username: string;
  role: 'admin' | 'agent';
}

export default function AgentsManagementPage() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState<'admin' | 'agent'>('agent');
  const [submitLoading, setSubmitLoading] = useState(false);

  async function loadData() {
    try {
      const [meRes, usersRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/users')
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setAgents(usersData);
      } else {
        const errData = await usersRes.json();
        setError(errData.error || 'فشل تحميل قائمة الحسابات');
      }
    } catch (err) {
      setError('حدث خطأ أثناء تحميل البيانات من الخادم');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditMode(false);
    setSelectedAgentId('');
    setUsernameInput('');
    setPasswordInput('');
    setRoleInput('agent');
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditMode(true);
    setSelectedAgentId(agent.id);
    setUsernameInput(agent.username);
    setPasswordInput('');
    setRoleInput(agent.role);
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب الوكيل (${name}) بالكامل؟ لن يتمكن من تسجيل الدخول للنظام بعد الآن.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف الوكيل');
      }

      setAgents(prev => prev.filter(a => a.id !== id));
      setSuccess('تم حذف الحساب بنجاح');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!usernameInput.trim()) {
      setError('يرجى كتابة اسم المستخدم');
      return;
    }

    if (!editMode && !passwordInput.trim()) {
      setError('يرجى تعيين كلمة مرور للحساب الجديد');
      return;
    }

    setSubmitLoading(true);
    try {
      const url = '/api/users';
      const method = editMode ? 'PATCH' : 'POST';
      const bodyPayload: any = {
        username: usernameInput.trim(),
        role: roleInput
      };

      if (editMode) {
        bodyPayload.id = selectedAgentId;
        if (passwordInput.trim()) {
          bodyPayload.password = passwordInput.trim();
        }
      } else {
        bodyPayload.password = passwordInput.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حفظ التعديلات');
      }

      setSuccess(editMode ? 'تم تعديل الحساب بنجاح' : 'تم إنشاء الحساب بنجاح');
      setModalOpen(false);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-swiss-lavender" />
        <span className="text-sm font-semibold">جاري تحميل قائمة الوكلاء...</span>
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 max-w-md mx-auto text-center select-none px-4">
        <div className="w-12 h-12 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-zinc-100">عذراً، الوصول غير مصرح به</h3>
        <p className="text-zinc-400 text-xs font-semibold leading-relaxed">
          هذه الصفحة مخصصة لمدير النظام الرئيسي فقط لإدارة حسابات وكلاء المبيعات وتعديل صلاحياتهم.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none px-4 py-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="w-6 h-6 text-swiss-lavender" />
            <span>إدارة وكلاء المبيعات</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            تسجيل حسابات وكلاء جدد، تحديث كلمات السر، وسحب الصلاحيات.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-5 py-2.5 swiss-btn-lavender flex items-center justify-center gap-2 cursor-pointer text-xs"
        >
          <UserPlus className="w-4 h-4 text-zinc-950" />
          <span>إضافة وكيل جديد</span>
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-950/20 border border-emerald-800 text-emerald-300 text-xs font-bold rounded-lg">
          <Check className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && !modalOpen && (
        <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800 text-red-300 text-xs font-bold rounded-lg">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="swiss-panel rounded-lg overflow-hidden border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-900/40 border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider select-none">
                <th className="py-4 px-6 border-l border-zinc-800/60">اسم المستخدم للوكيل</th>
                <th className="py-4 px-6 text-center border-l border-zinc-800/60">مستوى الصلاحية</th>
                <th className="py-4 px-6 text-center border-l border-zinc-800/60">تاريخ التسجيل</th>
                <th className="py-4 px-6 text-center w-28">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs font-semibold">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-zinc-900/10 transition-colors">
                  <td className="py-4 px-6 border-l border-zinc-800/40">
                    <div className="flex items-center gap-3 font-bold text-zinc-200 select-all">
                      <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                        {agent.role === 'admin' ? <UserCheck className="w-4 h-4 text-swiss-lavender" /> : <Users className="w-4 h-4 text-zinc-500" />}
                      </div>
                      <span>{agent.username}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center border-l border-zinc-800/40">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full border font-bold text-[10px] ${
                      agent.role === 'admin' 
                        ? 'bg-swiss-lavender/10 text-swiss-lavender border-swiss-lavender/25' 
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}>
                      {agent.role === 'admin' ? 'مدير النظام' : 'وكيل مبيعات'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-zinc-400 text-center text-xs font-mono border-l border-zinc-800/40">
                    {new Date(agent.createdAt).toLocaleString('ar-IQ')}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEditModal(agent)}
                        className="p-1.5 swiss-btn-neutral cursor-pointer"
                        title="تعديل"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      
                      <button
                        onClick={() => handleDelete(agent.id, agent.username)}
                        className="p-1.5 swiss-btn-neutral text-red-400 hover:bg-red-500/10 hover:text-red-300 border-red-500/20 cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Agent Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5 shadow-2xl">
            
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="w-8 h-8 rounded bg-swiss-lavender/10 border border-swiss-lavender/20 flex items-center justify-center text-swiss-lavender">
                {editMode ? <Edit className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {editMode ? 'تعديل صلاحيات الحساب' : 'إنشاء حساب وكيل جديد'}
                </h3>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-800 text-red-300 text-xs font-bold rounded-lg">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4">
              
              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  اسم المستخدم للوكيل (أحرف إنجليزية)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 pl-3">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-xs font-semibold text-left font-mono"
                    placeholder="sales_agent"
                    disabled={submitLoading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-zinc-500" />
                  <span>كلمة المرور</span>
                  {editMode && <span className="text-[9px] text-zinc-500 font-bold">(اتركها فارغة لعدم التعديل)</span>}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800 pl-3">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    dir="ltr"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pr-12 pl-4 py-2.5 swiss-input text-xs font-semibold text-left font-mono"
                    placeholder="••••••••"
                    disabled={submitLoading}
                  />
                </div>
              </div>

              {/* Role dropdown */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  مستوى الصلاحية
                </label>
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as 'admin' | 'agent')}
                  className="w-full px-4 py-2.5 swiss-input text-xs font-semibold bg-[#0c0c0e]"
                  disabled={submitLoading}
                >
                  <option value="agent">وكيل مبيعات (إضافة مبيعات وسحب الكودات)</option>
                  <option value="admin">مدير نظام (صلاحيات كاملة للتحكم بالمخزن)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 border-t border-zinc-800 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitLoading}
                  className="px-5 py-2.5 swiss-btn-neutral text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-6 py-2.5 swiss-btn-lavender text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {submitLoading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <Check className="w-4 h-4 text-zinc-950" />}
                  <span>{editMode ? 'حفظ التعديل' : 'إنشاء الحساب'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

