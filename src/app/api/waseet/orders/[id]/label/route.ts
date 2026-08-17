import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ordersRepository } from '@/modules/database/orders-repository';
import { waseetClient } from '@/modules/waseet/client';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!getSessionUser(req)) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    const { id } = await context.params;
    const order = await ordersRepository.getById(Number(id));
    if (!order) return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });
    if (!order.waseet_qr_link) {
      return NextResponse.json({ error: 'ملصق الوسيط غير متوفر لهذا الطلب.' }, { status: 404 });
    }
    const label = await waseetClient.fetchLabel(order.waseet_qr_link);
    return new NextResponse(label.body, {
      headers: {
        'content-type': label.contentType,
        'content-disposition': `inline; filename="waseet-${order.waseet_qr_id || order.id}.pdf"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحميل ملصق الوسيط.' },
      { status: 500 },
    );
  }
}
