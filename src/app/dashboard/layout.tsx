'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  PlusCircle, 
  History, 
  Database, 
  Users, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X, 
  User as UserIcon, 
  ShieldCheck,
  Loader2,
  Banknote
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'agent';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4 text-zinc-400">
        <Loader2 className="w-10 h-10 animate-spin text-swiss-lavender" />
        <span className="text-xs font-semibold tracking-wider">جاري التحقق من صلاحيات الدخول...</span>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    {
      name: 'إضافة طلب',
      href: '/dashboard/add-order',
      icon: PlusCircle,
      roles: ['admin', 'agent'],
    },
    {
      name: 'الطلبات السابقة',
      href: '/dashboard/orders',
      icon: History,
      roles: ['admin', 'agent'],
    },
    {
      name: 'مخزن الكودات',
      href: '/dashboard/codes',
      icon: Database,
      roles: ['admin', 'agent'],
    },
    {
      name: 'فواتير الوسيط',
      href: '/dashboard/waseet-finance',
      icon: Banknote,
      roles: ['admin'],
    },
    {
      name: 'إدارة الوكلاء',
      href: '/dashboard/agents',
      icon: Users,
      roles: ['admin'],
    },
    {
      name: 'الإعدادات والقوالب',
      href: '/dashboard/settings',
      icon: SettingsIcon,
      roles: ['admin'],
    },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col md:flex-row">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#121214] border-l border-zinc-800 shrink-0 select-none">
        
        {/* Sidebar Header Logo */}
        <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-swiss-lavender/10 border border-swiss-lavender/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-swiss-lavender" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-zinc-100 tracking-tight">بوابة المبيعات</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">أ. حسن فلاح</p>
          </div>
        </div>

        {/* User Badge Info */}
        <div className="p-4 mx-4 my-4 bg-zinc-950/40 border border-zinc-800/80 rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
            <UserIcon className="w-3.5 h-3.5" />
          </div>
          <div className="overflow-hidden">
            <h3 className="font-bold text-xs text-zinc-200 truncate">{user.username}</h3>
            <span className={`inline-block text-[9px] px-2 py-0.5 border rounded-full font-bold mt-1 ${
              user.role === 'admin' 
                ? 'bg-swiss-lavender/10 text-swiss-lavender border-swiss-lavender/25' 
                : 'bg-zinc-800 text-zinc-300 border-zinc-700'
            }`}>
              {user.role === 'admin' ? 'مدير النظام' : 'وكيل مبيعات'}
            </span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive 
                    ? 'bg-swiss-lavender/10 text-swiss-lavender border-r-2 border-swiss-lavender' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-swiss-lavender' : 'text-zinc-500'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Action */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-xs font-semibold text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0 text-zinc-500 hover:text-red-400" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Header - Mobile */}
      <header className="md:hidden bg-[#121214] border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-swiss-lavender/10 border border-swiss-lavender/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-swiss-lavender" />
          </div>
          <span className="font-bold text-sm text-zinc-200">بوابة المبيعات</span>
        </div>

        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[57px] z-20 bg-[#09090b] border-t border-zinc-800 flex flex-col p-6 space-y-6">
          <div className="flex items-center gap-3 p-4 bg-[#121214] border border-zinc-800 rounded-lg">
            <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-zinc-200">{user.username}</h3>
              <span className={`inline-block text-[9px] px-2 py-0.5 border rounded-full font-bold mt-1 ${
                user.role === 'admin' 
                  ? 'bg-swiss-lavender/10 text-swiss-lavender border-swiss-lavender/25' 
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}>
                {user.role === 'admin' ? 'مدير النظام' : 'وكيل مبيعات'}
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isActive 
                      ? 'bg-swiss-lavender/10 text-swiss-lavender border-r-2 border-swiss-lavender' 
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-swiss-lavender' : 'text-zinc-500'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-md bg-red-500/10 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/20 transition-all duration-150 cursor-pointer text-xs"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-full">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

