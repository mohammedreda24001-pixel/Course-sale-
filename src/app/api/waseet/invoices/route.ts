import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { waseetClient } from '@/modules/waseet/client';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'عرض فواتير الوسيط يتطلب صلاحيات المدير.' }, { status: 403 });
    }
    const invoiceId = new URL(req.url).searchParams.get('invoiceId');
    if (invoiceId) return NextResponse.json(await waseetClient.getInvoiceOrders(invoiceId));
    return NextResponse.json({ invoices: await waseetClient.getInvoices() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر جلب فواتير الوسيط.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'تأكيد استلام الفاتورة يتطلب صلاحيات المدير.' }, { status: 403 });
    }
    const body = await req.json() as { invoiceId?: string | number };
    if (!body.invoiceId) return NextResponse.json({ error: 'معرف الفاتورة مطلوب.' }, { status: 400 });
    await waseetClient.receiveInvoice(body.invoiceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تأكيد استلام الفاتورة.' },
      { status: 400 },
    );
  }
}
