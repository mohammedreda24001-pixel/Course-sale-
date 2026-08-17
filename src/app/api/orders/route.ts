import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ordersRepository } from '@/modules/database/orders-repository';
import { orderSupportRepository } from '@/modules/database/order-support-repository';
import { waseetMetadataRepository } from '@/modules/waseet/metadata-repository';
import {
  createWaseetPayload,
  normalizeWaseetOrderInput,
  stablePayloadHash,
  toPublicOrder,
} from '@/modules/waseet/order-model';
import { waseetService } from '@/modules/waseet/service';
import { buildOrderConfirmation } from '@/modules/waseet/confirmation';
import type { WaseetSyncState } from '@/modules/waseet/types';

function parseOrderId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('معرف الطلب غير صالح.');
  return id;
}

function jsonError(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const receiptNumber = searchParams.get('receiptNumber');
    const lookupIds = searchParams.get('lookupIds');

    if (id) {
      const order = await ordersRepository.getById(parseOrderId(id));
      if (!order) return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });
      return NextResponse.json(toPublicOrder(order));
    }

    if (receiptNumber) {
      const order = await ordersRepository.getByReceiptNumber(receiptNumber.trim());
      if (!order) return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });
      return NextResponse.json(toPublicOrder(order));
    }

    if (lookupIds !== null) {
      const ids = lookupIds.split(',').map(Number);
      return NextResponse.json(await ordersRepository.listLookup(ids));
    }

    const result = await ordersRepository.list({
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('pageSize')) || 25,
      search: searchParams.get('search') || undefined,
      cityId: Number(searchParams.get('cityId')) || undefined,
      regionId: Number(searchParams.get('regionId')) || undefined,
      syncState: (searchParams.get('syncState') || undefined) as WaseetSyncState | undefined,
      statusId: searchParams.get('statusId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      includeArchived: searchParams.get('includeArchived') === '1',
    });
    return NextResponse.json({
      ...result,
      orders: result.orders.map(toPublicOrder),
    });
  } catch (error) {
    return jsonError(error, 'حدث خطأ أثناء جلب الطلبات.', 500);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || randomUUID();
  let createdOrderId: number | null = null;
  try {
    const user = getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });

    const body = await req.json() as Record<string, unknown>;
    if (body.dispatchNow === true && body.reviewConfirmed !== true) {
      return NextResponse.json(
        { error: 'يجب تأكيد المراجعة البشرية لجميع بيانات الطلب قبل الإرسال إلى الوسيط.' },
        { status: 400 },
      );
    }
    const input = normalizeWaseetOrderInput(body);
    const resolved = await waseetMetadataRepository.resolveSelection(
      input.waseetCityId,
      input.waseetRegionId,
      input.waseetPackageSizeId,
    );
    const payload = createWaseetPayload(input, resolved);
    const payloadHash = stablePayloadHash(payload);
    let order = await ordersRepository.create(input, resolved, user, payloadHash);
    createdOrderId = order.id;

    let dispatchWarning = '';
    let dispatchFailed = false;
    if (body.dispatchNow === true) {
      try {
        order = await waseetService.dispatch(order.id, user, requestId);
      } catch (dispatchError) {
        dispatchFailed = true;
        dispatchWarning = dispatchError instanceof Error
          ? dispatchError.message
          : 'تم حفظ الطلب محلياً، لكن تعذر إرساله إلى الوسيط.';
        order = await ordersRepository.getById(order.id) || order;
      }
    }

    let confirmationMessage = '';
    try {
      const [settings, courseTypes] = await Promise.all([
        orderSupportRepository.getSettings(),
        orderSupportRepository.getCourseTypes(),
      ]);
      const courseName = courseTypes.find(course => course.id === order.courseTypeId)?.name || '';
      confirmationMessage = buildOrderConfirmation(order, settings.confirmationTemplate, courseName);
    } catch (confirmationError) {
      const message = confirmationError instanceof Error
        ? confirmationError.message
        : 'تعذر إنشاء رسالة التأكيد.';
      dispatchWarning = [dispatchWarning, `حُفظ الطلب، لكن ${message}`].filter(Boolean).join(' ');
    }

    await ordersRepository.audit({
      orderId: order.id,
      action: 'order.create',
      actorId: user.id,
      actorUsername: user.username,
      success: true,
      requestId,
      details: {
        dispatchNow: body.dispatchNow === true,
        dispatchSucceeded: body.dispatchNow === true ? !dispatchFailed : null,
      },
    });

    return NextResponse.json({
      success: true,
      order: toPublicOrder(order),
      confirmationMessage,
      dispatchFailed,
      warning: dispatchWarning || undefined,
    }, { status: dispatchFailed ? 202 : 200 });
  } catch (error) {
    const user = getSessionUser(req);
    await ordersRepository.audit({
      orderId: createdOrderId || undefined,
      action: 'order.create',
      actorId: user?.id,
      actorUsername: user?.username,
      success: false,
      message: error instanceof Error ? error.message : 'فشل إنشاء الطلب.',
      requestId,
      details: { localOrderMayExist: createdOrderId !== null },
    });
    return jsonError(error, 'حدث خطأ أثناء حفظ الطلب.');
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || randomUUID();
  try {
    const user = getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });

    const body = await req.json() as Record<string, unknown>;
    const id = parseOrderId(body.id);
    const current = await ordersRepository.getById(id);
    if (!current) return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });

    const rawUpdates = body.updates && typeof body.updates === 'object'
      ? { ...(body.updates as Record<string, unknown>) }
      : { ...body };
    if (!current.courseTypeId) {
      throw new Error('الطلب التاريخي لا يحتوي نوع دورة وكوداً صالحاً؛ أصلح ربطه قبل تعديل بيانات الشحنة.');
    }
    if (rawUpdates.courseTypeId !== undefined && Number(rawUpdates.courseTypeId) !== Number(current.courseTypeId)) {
      throw new Error('لا يمكن تغيير نوع الدورة من شاشة تعديل الشحنة لأن الكود المحجوز مرتبط بالدورة الأصلية.');
    }
    rawUpdates.courseTypeId = current.courseTypeId;
    const input = normalizeWaseetOrderInput(rawUpdates);
    const resolved = await waseetMetadataRepository.resolveSelection(
      input.waseetCityId,
      input.waseetRegionId,
      input.waseetPackageSizeId,
    );
    const updated = await waseetService.edit(current, input, resolved, user, requestId);
    return NextResponse.json({ success: true, order: toPublicOrder(updated) });
  } catch (error) {
    return jsonError(error, 'حدث خطأ أثناء تعديل الطلب.');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'أرشفة الطلب تتطلب صلاحيات المدير.' }, { status: 403 });
    }
    const id = parseOrderId(new URL(req.url).searchParams.get('id'));
    await ordersRepository.archiveDraft(id, user);
    return NextResponse.json({ success: true, message: 'تمت أرشفة الطلب وإرجاع الكود المتاح بأمان.' });
  } catch (error) {
    return jsonError(error, 'تعذرت أرشفة الطلب.');
  }
}
