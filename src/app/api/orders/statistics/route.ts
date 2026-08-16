import { NextRequest, NextResponse } from 'next/server';
import { ordersRepository } from '@/modules/database/orders-repository';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'تاريخ البدء وتاريخ الانتهاء مطلوبان.' }, { status: 400 });
    }

    const orders = await ordersRepository.getByDateRange(startDate, endDate);
    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
