import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ordersRepository } from '@/modules/database/orders-repository';
import { toPublicOrder } from '@/modules/waseet/order-model';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'تاريخ البداية والنهاية مطلوبان.' }, { status: 400 });
    }
    const orders = await ordersRepository.getByDateRange(startDate, endDate);
    return NextResponse.json(orders.map(toPublicOrder));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر جلب التقرير.' },
      { status: 500 },
    );
  }
}
