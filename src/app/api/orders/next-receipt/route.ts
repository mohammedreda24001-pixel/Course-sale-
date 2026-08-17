import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ordersRepository } from '@/modules/database/orders-repository';

export async function GET(req: NextRequest) {
  try {
    if (!getSessionUser(req)) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    return NextResponse.json({ nextReceiptNumber: await ordersRepository.getNextReceiptNumber() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر إنشاء رقم الوصل.' },
      { status: 500 },
    );
  }
}
