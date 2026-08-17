import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return fallback;
}


function hasErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && String((error as { code?: unknown }).code) === code
  );
}

function parseCourseInput(payload: Record<string, unknown>) {
  const name = String(payload.name || '').trim();
  const defaultPrice = Number(payload.defaultPrice);
  if (!name) throw new Error('اسم الدورة مطلوب.');
  if (!Number.isFinite(defaultPrice) || defaultPrice <= 0) throw new Error('المبلغ الافتراضي غير صالح.');
  return { name, defaultPrice };
}

export async function GET(req: NextRequest) {
  if (!getSessionUser(req)) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
  try {
    return NextResponse.json(await db.getCourseTypes());
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, 'تعذر جلب الدورات.') }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'صلاحيات المدير مطلوبة.' }, { status: 403 });
  try {
    const input = parseCourseInput(await req.json());
    const course = await db.createCourseType(input.name, input.defaultPrice);
    return NextResponse.json({ success: true, course }, { status: 201 });
  } catch (error) {
    const duplicate = hasErrorCode(error, '23505');
    return NextResponse.json({ error: duplicate ? 'اسم الدورة موجود مسبقاً.' : errorMessage(error, 'تعذرت إضافة الدورة.') }, { status: duplicate ? 409 : 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'صلاحيات المدير مطلوبة.' }, { status: 403 });
  try {
    const payload = await req.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('معرف الدورة غير صالح.');
    const input = parseCourseInput(payload);
    const course = await db.updateCourseType(id, input.name, input.defaultPrice);
    return NextResponse.json({ success: true, course });
  } catch (error) {
    const duplicate = hasErrorCode(error, '23505');
    return NextResponse.json({ error: duplicate ? 'اسم الدورة مستخدم مسبقاً.' : errorMessage(error, 'تعذر تحديث الدورة.') }, { status: duplicate ? 409 : 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'صلاحيات المدير مطلوبة.' }, { status: 403 });
  try {
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('معرف الدورة غير صالح.');

    const [{ count: ordersCount, error: ordersError }, { count: codesCount, error: codesError }] = await Promise.all([
      supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('courseTypeId', id),
      supabaseAdmin.from('codes').select('id', { count: 'exact', head: true }).eq('courseTypeId', id),
    ]);
    if (ordersError) throw ordersError;
    if (codesError) throw codesError;
    if ((ordersCount || 0) > 0 || (codesCount || 0) > 0) {
      return NextResponse.json({ error: 'لا يمكن حذف دورة مرتبطة بطلبات أو أكواد.' }, { status: 409 });
    }

    await db.deleteCourseType(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, 'تعذر حذف الدورة.') }, { status: 400 });
  }
}
