import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { toPublicOrder } from '@/modules/waseet/order-model';
import { waseetService } from '@/modules/waseet/service';

export const maxDuration = 60;


const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    const body = await req.json() as { ids?: unknown[] };
    const ids = [...new Set((body.ids || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 10);
    if (ids.length === 0) return NextResponse.json({ error: 'اختر طلباً واحداً على الأقل.' }, { status: 400 });

    const results: Array<{ id: number; success: boolean; order?: unknown; error?: string }> = [];
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      try {
        const order = await waseetService.dispatch(id, user);
        results.push({ id, success: true, order: toPublicOrder(order) });
      } catch (error) {
        results.push({ id, success: false, error: error instanceof Error ? error.message : 'فشل الإرسال.' });
      }
      if (index < ids.length - 1) await pause(1_050);
    }
    return NextResponse.json({ success: results.some(result => result.success), results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'فشل الإرسال الجماعي.' },
      { status: 400 },
    );
  }
}
