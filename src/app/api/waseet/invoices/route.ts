import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ordersRepository } from '@/modules/database/orders-repository';
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
  const requestId = req.headers.get('x-request-id') || randomUUID();
  const user = getSessionUser(req);
  try {
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'تأكيد استلام الفاتورة يتطلب صلاحيات المدير.' }, { status: 403 });
    }
    const body = await req.json() as { invoiceId?: string | number; confirmReceipt?: boolean };
    if (!body.invoiceId) return NextResponse.json({ error: 'معرف الفاتورة مطلوب.' }, { status: 400 });
    if (body.confirmReceipt !== true) {
      return NextResponse.json({ error: 'يلزم تأكيد استلام الفاتورة صراحةً.' }, { status: 400 });
    }
    await waseetClient.receiveInvoice(body.invoiceId);
    await ordersRepository.audit({
      action: 'waseet.invoice.receive',
      actorId: user.id,
      actorUsername: user.username,
      success: true,
      requestId,
      details: { invoiceId: String(body.invoiceId) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (user) {
      await ordersRepository.audit({
        action: 'waseet.invoice.receive',
        actorId: user.id,
        actorUsername: user.username,
        success: false,
        message: error instanceof Error ? error.message : 'تعذر تأكيد استلام الفاتورة.',
        requestId,
      });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تأكيد استلام الفاتورة.' },
      { status: 400 },
    );
  }
}
