import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface CodeInput {
  codeValue: string;
  serialNumber: string;
}

function parseBulkCodes(rawText: string): CodeInput[] {
  const seen = new Set<string>();
  const result: CodeInput[] = [];

  for (const rawLine of rawText.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = line.split(/\t|,|;|،/).map(value => value.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const codeValue = cells[0].slice(0, 100);
    const serialNumber = cells.slice(1).join('-').slice(0, 100);
    const key = codeValue.toLocaleLowerCase('en-US');
    if (!codeValue || !serialNumber || seen.has(key)) continue;
    seen.add(key);
    result.push({ codeValue, serialNumber });
  }
  return result;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && String((error as { code?: unknown }).code) === code);
}

function requireAdmin(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    if (!getSessionUser(req)) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    let query = supabaseAdmin
      .from('codes')
      .select('id,codeValue,serialNumber,status,orderId,assignedAt,courseTypeId,isDisabled,createdAt')
      .order('createdAt', { ascending: false });

    const status = searchParams.get('status');
    const courseTypeId = Number(searchParams.get('courseTypeId'));
    if (status === 'available' || status === 'used') query = query.eq('status', status);
    if (Number.isSafeInteger(courseTypeId) && courseTypeId > 0) query = query.eq('courseTypeId', courseTypeId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Codes GET error:', error);
    return NextResponse.json({ error: 'تعذر جلب كودات المخزن.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'هذه العملية للمدير فقط.' }, { status: 403 });
    const body = await req.json() as { rawText?: string; courseTypeId?: number };
    const courseTypeId = Number(body.courseTypeId);
    if (!Number.isSafeInteger(courseTypeId) || courseTypeId < 1) {
      return NextResponse.json({ error: 'اختر نوع دورة صالحاً.' }, { status: 400 });
    }

    const parsed = parseBulkCodes(String(body.rawText || ''));
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على سطر صالح بصيغة: الكود، الرقم التسلسلي.' }, { status: 400 });
    }
    if (parsed.length > 5_000) {
      return NextResponse.json({ error: 'الدفعة أكبر من الحد المسموح (5000 كود).' }, { status: 400 });
    }

    const existing = new Set<string>();
    for (let index = 0; index < parsed.length; index += 500) {
      const existingResult = await supabaseAdmin
        .from('codes')
        .select('codeValue')
        .in('codeValue', parsed.slice(index, index + 500).map(item => item.codeValue));
      if (existingResult.error) throw existingResult.error;
      (existingResult.data || []).forEach((item: { codeValue?: unknown }) => {
        existing.add(String(item.codeValue).toLocaleLowerCase('en-US'));
      });
    }
    const fresh = parsed.filter(item => !existing.has(item.codeValue.toLocaleLowerCase('en-US')));

    if (fresh.length === 0) {
      return NextResponse.json({ error: 'جميع الكودات المرسلة موجودة مسبقاً.' }, { status: 409 });
    }

    let inserted = 0;
    for (let index = 0; index < fresh.length; index += 500) {
      const { data, error } = await supabaseAdmin
        .from('codes')
        .insert(fresh.slice(index, index + 500).map(item => ({
          id: randomUUID(),
          codeValue: item.codeValue,
          serialNumber: item.serialNumber,
          status: 'available',
          courseTypeId,
          isDisabled: false,
        })))
        .select('id');
      if (error) throw error;
      inserted += data?.length || 0;
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped: parsed.length - fresh.length,
      message: `تمت إضافة ${inserted} كود إلى المخزن${parsed.length > fresh.length ? ` وتجاوز ${parsed.length - fresh.length} مكرر` : ''}.`,
    });
  } catch (error) {
    console.error('Codes POST error:', error);
    const duplicate = hasErrorCode(error, '23505');
    return NextResponse.json(
      { error: duplicate ? 'يوجد كود مكرر داخل الدفعة أو في قاعدة البيانات.' : 'تعذر إضافة الكودات.' },
      { status: duplicate ? 409 : 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'هذه العملية للمدير فقط.' }, { status: 403 });
    const body = await req.json() as {
      id?: string;
      action?: 'toggleDisabled';
      codeValue?: string;
      serialNumber?: string;
      courseTypeId?: number;
    };
    if (!body.id) return NextResponse.json({ error: 'معرف الكود مطلوب.' }, { status: 400 });

    if (body.action === 'toggleDisabled') {
      const { data: current, error: readError } = await supabaseAdmin
        .from('codes')
        .select('isDisabled')
        .eq('id', body.id)
        .maybeSingle();
      if (readError) throw readError;
      if (!current) return NextResponse.json({ error: 'الكود غير موجود.' }, { status: 404 });
      const isDisabled = !Boolean(current.isDisabled);
      const { error } = await supabaseAdmin.from('codes').update({ isDisabled }).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true, isDisabled });
    }

    const { data: currentCode, error: currentError } = await supabaseAdmin
      .from('codes')
      .select('status,orderId')
      .eq('id', body.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!currentCode) return NextResponse.json({ error: 'الكود غير موجود.' }, { status: 404 });
    if (currentCode.status === 'used' || currentCode.orderId) {
      return NextResponse.json({ error: 'لا يمكن تعديل كود مرتبط بطلب؛ يجب الحفاظ على الكود الذي استلمه الطالب.' }, { status: 409 });
    }

    const codeValue = String(body.codeValue || '').trim();
    const serialNumber = String(body.serialNumber || '').trim();
    const courseTypeId = Number(body.courseTypeId);
    if (!codeValue || !serialNumber || !Number.isSafeInteger(courseTypeId) || courseTypeId < 1) {
      return NextResponse.json({ error: 'الكود والسيريال ونوع الدورة مطلوبة.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('codes')
      .update({ codeValue: codeValue.slice(0, 100), serialNumber: serialNumber.slice(0, 100), courseTypeId })
      .eq('id', body.id)
      .select('id,codeValue,serialNumber,status,orderId,assignedAt,courseTypeId,isDisabled,createdAt')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, code: data });
  } catch (error) {
    console.error('Codes PATCH error:', error);
    const duplicate = hasErrorCode(error, '23505');
    return NextResponse.json(
      { error: duplicate ? 'قيمة الكود موجودة مسبقاً.' : 'تعذر تحديث الكود.' },
      { status: duplicate ? 409 : 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'هذه العملية للمدير فقط.' }, { status: 403 });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'معرف الكود مطلوب.' }, { status: 400 });

    const { data: code, error: readError } = await supabaseAdmin
      .from('codes')
      .select('status,orderId')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw readError;
    if (!code) return NextResponse.json({ error: 'الكود غير موجود.' }, { status: 404 });
    if (code.status === 'used' || code.orderId) {
      return NextResponse.json({ error: 'لا يمكن حذف كود مرتبط بطلب. عطّله بدلاً من ذلك.' }, { status: 409 });
    }

    const { error } = await supabaseAdmin.from('codes').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Codes DELETE error:', error);
    return NextResponse.json({ error: 'تعذر حذف الكود.' }, { status: 500 });
  }
}
