import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ordersRepository } from '@/modules/database/orders-repository';
import { waseetClient } from '@/modules/waseet/client';
import { toPublicOrder } from '@/modules/waseet/order-model';

function comparablePhone(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.slice(-10);
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get('x-request-id') || randomUUID();
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'حسم محاولة إرسال غير مؤكدة يتطلب صلاحيات المدير.' }, { status: 403 });
    }

    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isSafeInteger(orderId) || orderId < 1) {
      return NextResponse.json({ error: 'معرف الطلب غير صالح.' }, { status: 400 });
    }

    const body = await req.json() as { resolution?: unknown; waseetOrderId?: unknown };
    const resolution = String(body.resolution || '');
    const order = await ordersRepository.getById(orderId);
    if (!order) return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });
    if (order.waseet_sync_state !== 'needs_verification') {
      return NextResponse.json({ error: 'الطلب ليس ضمن حالة تحتاج تحققاً يدوياً.' }, { status: 409 });
    }

    if (resolution === 'not_created') {
      if (order.waseet_order_id || order.waseet_qr_id) {
        return NextResponse.json({ error: 'الطلب يحتوي معرف شحنة محفوظاً؛ لا يمكن اعتباره غير منشأ.' }, { status: 409 });
      }
      const updated = await ordersRepository.updateLocal(order.id, {
        waseet_sync_state: 'pending',
        waseet_last_error: '',
        waseet_dispatch_key: null,
      });
      await ordersRepository.audit({
        orderId: order.id,
        action: 'waseet.resolve-not-created',
        actorId: user.id,
        actorUsername: user.username,
        success: true,
        requestId,
        message: 'أكد المدير بعد التحقق من تطبيق الوسيط أن الشحنة لم تُنشأ.',
      });
      return NextResponse.json({ success: true, order: toPublicOrder(updated) });
    }

    if (resolution === 'created') {
      const waseetOrderId = String(body.waseetOrderId || '').trim();
      if (!waseetOrderId) {
        return NextResponse.json({ error: 'أدخل رقم الطلب الظاهر في تطبيق الوسيط.' }, { status: 400 });
      }
      const records = await waseetClient.getOrdersByIds([waseetOrderId]);
      const record = records.find(item => String(item.id || '') === waseetOrderId);
      if (!record) {
        return NextResponse.json({ error: 'لم يُرجع الوسيط شحنة بهذا الرقم.' }, { status: 404 });
      }
      if (!record.qr_id) {
        return NextResponse.json({ error: 'أعاد الوسيط الشحنة من دون QR؛ لم يتم ربطها محلياً.' }, { status: 409 });
      }

      const localPhone = comparablePhone(order.phone1);
      const remotePhone = comparablePhone(record.client_mobile);
      if (localPhone && remotePhone && localPhone !== remotePhone) {
        return NextResponse.json({ error: 'هاتف الشحنة في الوسيط لا يطابق هاتف الطلب المحلي؛ أُلغي الربط لحماية البيانات.' }, { status: 409 });
      }

      const updated = await ordersRepository.applySyncedRecord(order, record);
      await ordersRepository.audit({
        orderId: order.id,
        action: 'waseet.resolve-created',
        actorId: user.id,
        actorUsername: user.username,
        success: true,
        requestId,
        details: { waseetOrderId: record.id, qrId: record.qr_id },
      });
      return NextResponse.json({ success: true, order: toPublicOrder(updated) });
    }

    return NextResponse.json({ error: 'قرار التحقق غير صالح.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر حسم محاولة الإرسال.' },
      { status: 400 },
    );
  }
}
