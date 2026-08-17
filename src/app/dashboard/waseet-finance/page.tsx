'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Banknote, CheckCircle2, Eye, Loader2, RefreshCw, X } from 'lucide-react';

interface Invoice {
  id: string | number;
  merchant_price?: string | number;
  delivered_orders_count?: string | number;
  replacement_delivered_orders_count?: string | number;
  status?: string;
  updated_at?: string;
  [key: string]: unknown;
}

function money(value: unknown) {
  return `${Number(value || 0).toLocaleString('ar-IQ')} د.ع`;
}

export default function WaseetFinancePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [details, setDetails] = useState<unknown>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [receivingId, setReceivingId] = useState<string | number | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/waseet/invoices', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'تعذر جلب الفواتير.');
      setInvoices(payload.invoices || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر جلب الفواتير.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function openDetails(invoice: Invoice) {
    setSelected(invoice);
    setDetailsLoading(true);
    setDetails(null);
    try {
      const response = await fetch(`/api/waseet/invoices?invoiceId=${encodeURIComponent(String(invoice.id))}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'تعذر جلب تفاصيل الفاتورة.');
      setDetails(payload);
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : 'تعذر جلب تفاصيل الفاتورة.');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function receive(invoice: Invoice) {
    if (!window.confirm(`تأكيد استلام فاتورة الوسيط #${invoice.id}؟`)) return;
    setReceivingId(invoice.id);
    try {
      const response = await fetch('/api/waseet/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'تعذر تأكيد الاستلام.');
      await load();
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : 'تعذر تأكيد الاستلام.');
    } finally {
      setReceivingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8 space-y-6" dir="rtl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300"><Banknote className="h-3.5 w-3.5" />Waseet Finance</div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">فواتير الوسيط</h1>
          <p className="mt-2 text-sm text-zinc-400">الأجور والصافي وحالة التسوية معروضة كما يعيدها الوسيط، وليست حسابات توصيل محلية.</p>
        </div>
        <button type="button" onClick={() => void load()} className="swiss-btn-neutral inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />تحديث</button>
      </header>

      {error ? <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div> : null}

      <section className="swiss-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-500"><tr><th className="p-4">الفاتورة</th><th className="p-4">صافي التاجر</th><th className="p-4">طلبات مسلمة</th><th className="p-4">استبدالات</th><th className="p-4">الحالة</th><th className="p-4">آخر تحديث</th><th className="p-4">إجراء</th></tr></thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? <tr><td colSpan={7} className="p-12 text-center text-zinc-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr> : null}
              {!loading && invoices.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-zinc-500">لا توجد فواتير حالياً.</td></tr> : null}
              {invoices.map(invoice => (
                <tr key={String(invoice.id)} className="hover:bg-zinc-900/40">
                  <td className="p-4 font-mono font-bold text-white">#{String(invoice.id)}</td>
                  <td className="p-4 font-bold text-emerald-300">{money(invoice.merchant_price)}</td>
                  <td className="p-4 text-zinc-300">{String(invoice.delivered_orders_count || 0)}</td>
                  <td className="p-4 text-zinc-300">{String(invoice.replacement_delivered_orders_count || 0)}</td>
                  <td className="p-4"><span className="rounded-full border border-swiss-lavender/25 bg-swiss-lavender/10 px-2.5 py-1 text-[10px] font-bold text-swiss-lavender">{invoice.status || '—'}</span></td>
                  <td className="p-4 text-zinc-500">{invoice.updated_at ? new Date(invoice.updated_at).toLocaleString('ar-IQ') : '—'}</td>
                  <td className="p-4"><div className="flex gap-2"><button type="button" onClick={() => void openDetails(invoice)} className="swiss-btn-neutral flex items-center gap-1.5 px-3 py-2"><Eye className="h-3.5 w-3.5" />تفاصيل</button><button type="button" disabled={receivingId === invoice.id} onClick={() => void receive(invoice)} className="swiss-btn-lavender flex items-center gap-1.5 px-3 py-2 disabled:opacity-50">{receivingId === invoice.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}استلام</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-white">تفاصيل فاتورة #{String(selected.id)}</h2><button type="button" onClick={() => setSelected(null)} className="p-2 text-zinc-500 hover:text-white"><X className="h-5 w-5" /></button></div>{detailsLoading ? <Loader2 className="mx-auto my-14 h-7 w-7 animate-spin text-swiss-lavender" /> : <pre className="mt-5 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/40 p-4 text-xs leading-6 text-zinc-300">{JSON.stringify(details, null, 2)}</pre>}</div></div> : null}
    </div>
  );
}
