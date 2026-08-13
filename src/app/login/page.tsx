'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogIn, Lock, User as UserIcon, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ ما أثناء تسجيل الدخول');
      }

      router.push('/dashboard/add-order');
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#09090b] px-4 select-none">
      {/* Subtle minimalist grid background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_60%,transparent_100%)] opacity-25"></div>

      <div className="relative w-full max-w-md my-8">
        
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-swiss-lavender/10 border border-swiss-lavender/20 mb-4">
            <LogIn className="w-5 h-5 text-swiss-lavender" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight block">
            بوابة المبيعات والطلبات
          </h1>
          <p className="text-zinc-500 mt-2 text-xs font-semibold tracking-wider">
            الدورات الإلكترونية للأستاذ حسن فلاح
          </p>
        </div>

        {/* Card */}
        <div className="swiss-panel p-8 rounded-lg relative border border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-100 mb-6 text-right border-r-2 border-swiss-lavender pr-3">
            تسجيل الدخول للنظام
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-md">
                <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                اسم المستخدم
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800/80 pl-3">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-xs font-semibold"
                  placeholder="admin"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-500 border-l border-zinc-800/80 pl-3">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-12 pl-4 py-2.5 swiss-input text-left font-mono text-xs font-semibold"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 swiss-btn-lavender flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <LogIn className="w-4 h-4 rotate-180 text-zinc-950" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-zinc-800/80 pt-4 text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
            محمي بروتوكول حماية موحد
          </div>
        </div>
      </div>
    </div>
  );
}

