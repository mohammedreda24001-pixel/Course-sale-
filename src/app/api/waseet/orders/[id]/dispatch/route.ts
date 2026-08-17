import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { toPublicOrder } from '@/modules/waseet/order-model';
import { waseetService } from '@/modules/waseet/service';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isSafeInteger(orderId) || orderId < 1) {
      return NextResponse.json({ error: 'معرف الطلب غير صالح.' }, { status: 400 });
    }
    const order = await waseetService.dispatch(orderId, user, req.headers.get('x-request-id') || undefined);
    return NextResponse.json({ success: true, order: toPublicOrder(order) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'فشل إرسال الطلب إلى الوسيط.' },
      { status: 400 },
    );
  }
}
