import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const nextReceiptNumber = await db.getNextReceiptNumber();
    return NextResponse.json({ nextReceiptNumber });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
