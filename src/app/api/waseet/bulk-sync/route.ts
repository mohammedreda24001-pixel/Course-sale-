import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { toPublicOrder } from '@/modules/waseet/order-model';
import { waseetService } from '@/modules/waseet/service';

export const maxDuration = 60;


export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    const body = await req.json() as { ids?: unknown[] };
    const ids = [...new Set((body.ids || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 250);
    if (ids.length === 0) return NextResponse.json({ error: 'اختر طلباً واحداً على الأقل.' }, { status: 400 });
    const results = await waseetService.sync(ids, user);
    return NextResponse.json({
      success: results.some(result => result.success),
      results: results.map(result => ({
        ...result,
        order: result.order ? toPublicOrder(result.order) : undefined,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'فشلت المزامنة الجماعية.' },
      { status: 400 },
    );
  }
}
