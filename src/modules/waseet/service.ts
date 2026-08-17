import 'server-only';

import { randomUUID } from 'node:crypto';
import { ordersRepository, type Order } from '@/modules/database/orders-repository';
import { waseetClient, WaseetApiError } from './client';
import {
  composeWaseetLocation,
  createWaseetPayload,
  stablePayloadHash,
} from './order-model';
import type {
  WaseetCreateOrderPayload,
  WaseetOrderApiRecord,
  WaseetOrderInput,
} from './types';

export interface WaseetActor {
  id?: string;
  username?: string;
}

function payloadFromOrder(order: Order): WaseetCreateOrderPayload {
  if (!order.waseet_city_id || !order.waseet_region_id || !order.waseet_package_size_id) {
    throw new Error('الطلب لا يحتوي معرفات Waseet City/Region/Package Size كاملة.');
  }
  if (!order.waseet_city_name || !order.waseet_region_name || !order.waseet_package_size_name) {
    throw new Error('بيانات الوسيط النصية للطلب غير مكتملة.');
  }
  if (!order.address_details?.trim()) throw new Error('تفاصيل العنوان مطلوبة قبل الإرسال.');
  if (!order.phone1?.trim()) throw new Error('الهاتف الأساسي مطلوب قبل الإرسال.');
  if (!Number.isSafeInteger(Number(order.collection_amount)) || Number(order.collection_amount) < 1) {
    throw new Error('المبلغ المطلوب تحصيله غير صالح.');
  }

  return {
    client_name: order.studentName,
    client_mobile: order.phone1,
    client_mobile2: order.phone2 || undefined,
    city_id: String(order.waseet_city_id),
    region_id: String(order.waseet_region_id),
    location: composeWaseetLocation(order.address_details, order.location_hint),
    type_name: order.goods_type,
    items_number: Number(order.items_count),
    price: Number(order.collection_amount),
    package_size: String(order.waseet_package_size_id),
    merchant_notes: order.merchant_notes || undefined,
    replacement: order.replacement ? 1 : 0,
  };
}

function mapInputToDbUpdates(
  input: WaseetOrderInput,
  resolved: {
    city: { id: number; name: string };
    region: { id: number; name: string };
    packageSize: { id: number; name: string };
  },
) {
  return {
    studentName: input.studentName,
    phone1: input.phone1,
    phone2: input.phone2 || '',
    waseet_city_id: resolved.city.id,
    waseet_city_name: resolved.city.name,
    waseet_region_id: resolved.region.id,
    waseet_region_name: resolved.region.name,
    address_details: input.addressDetails,
    location_hint: input.locationHint || '',
    waseet_package_size_id: resolved.packageSize.id,
    waseet_package_size_name: resolved.packageSize.name,
    collection_amount: input.collectionAmount,
    items_count: input.itemsCount,
    replacement: input.replacement,
    goods_type: input.goodsType,
    merchant_notes: input.merchantNotes || '',
    receiptNumber: input.receiptNumber || null,
    courseTypeId: input.courseTypeId,
    internal_notes: input.internalNotes || '',
    telegram_username: input.telegramUsername || '',
    internal_order_state: 'ready' as const,
  };
}

function recordMatchesOrder(record: WaseetOrderApiRecord, order: Order): boolean {
  return String(record.id || '') === String(order.waseet_order_id || '') ||
    String(record.qr_id || '') === String(order.waseet_qr_id || '');
}

export const waseetService = {
  payloadFromOrder,
  mapInputToDbUpdates,

  async dispatch(orderId: number, actor: WaseetActor = {}, requestId: string = randomUUID()) {
    const initial = await ordersRepository.getById(orderId);
    if (!initial) throw new Error('الطلب غير موجود.');
    if (initial.internal_order_state === 'archived') throw new Error('لا يمكن إرسال طلب مؤرشف.');
    if (initial.waseet_qr_id) return initial;
    if (initial.waseet_sync_state === 'needs_verification') {
      throw new Error('هذه المحاولة تحتاج تحققاً يدوياً. لا تعِد Create قبل التأكد من تطبيق الوسيط.');
    }

    const payload = payloadFromOrder(initial);
    const payloadHash = stablePayloadHash(payload);
    const claimed = await ordersRepository.claimDispatch(orderId, payloadHash);
    const startedAt = Date.now();

    let remoteCreated: WaseetOrderApiRecord | null = null;
    try {
      remoteCreated = await waseetClient.createOrder(payload);
      const updated = await ordersRepository.markDispatchSuccess(claimed.id, remoteCreated);
      await Promise.all([
        ordersRepository.apiLog({
          orderId,
          endpoint: 'create-order',
          method: 'POST',
          success: true,
          durationMs: Date.now() - startedAt,
          requestId,
        }),
        ordersRepository.audit({
          orderId,
          action: 'waseet.dispatch',
          actorId: actor.id,
          actorUsername: actor.username,
          success: true,
          requestId,
          details: { waseetOrderId: updated.waseet_order_id, qrId: updated.waseet_qr_id },
        }),
      ]);
      return updated;
    } catch (error) {
      const remoteMayExist = Boolean(remoteCreated) || (error instanceof WaseetApiError && error.uncertain);
      const originalMessage = error instanceof Error ? error.message : 'فشل إرسال الطلب إلى الوسيط.';
      const message = remoteCreated
        ? 'أعاد الوسيط نتيجة إنشاء ناجحة، لكن تعذر تثبيتها محلياً. تحقّق من تطبيق الوسيط ولا تعِد الإرسال قبل حسم المحاولة.'
        : originalMessage;

      await Promise.allSettled([
        ordersRepository.markDispatchFailure(orderId, message, remoteMayExist),
        ordersRepository.apiLog({
          orderId,
          endpoint: 'create-order',
          method: 'POST',
          success: false,
          durationMs: Date.now() - startedAt,
          errorCode: error instanceof WaseetApiError ? error.code : undefined,
          errorMessage: message,
          requestId,
        }),
        ordersRepository.audit({
          orderId,
          action: 'waseet.dispatch',
          actorId: actor.id,
          actorUsername: actor.username,
          success: false,
          message,
          requestId,
          details: {
            uncertain: remoteMayExist,
            remoteOrderId: remoteCreated?.id || null,
            remoteQrId: remoteCreated?.qr_id || null,
            originalError: originalMessage,
          },
        }),
      ]);
      throw remoteCreated ? new Error(message) : error;
    }
  },

  async edit(
    order: Order,
    input: WaseetOrderInput,
    resolved: {
      city: { id: number; name: string };
      region: { id: number; name: string };
      packageSize: { id: number; name: string };
    },
    actor: WaseetActor = {},
    requestId: string = randomUUID(),
  ) {
    const dbUpdates = mapInputToDbUpdates(input, resolved);
    const payload = createWaseetPayload(input, resolved);
    const payloadHash = stablePayloadHash(payload);

    if (!order.waseet_qr_id) {
      const updated = await ordersRepository.updateLocal(order.id, {
        ...dbUpdates,
        waseet_payload_hash: payloadHash,
        waseet_sync_state: 'pending',
        waseet_last_error: '',
      });
      await ordersRepository.audit({
        orderId: order.id,
        action: 'order.edit-local',
        actorId: actor.id,
        actorUsername: actor.username,
        success: true,
        requestId,
      });
      return updated;
    }

    const startedAt = Date.now();
    let remoteEdited = false;
    try {
      await waseetClient.editOrder({ ...payload, qr_id: order.waseet_qr_id });
      remoteEdited = true;
      let remote: WaseetOrderApiRecord | undefined;
      if (order.waseet_order_id) {
        try {
          const records = await waseetClient.getOrdersByIds([order.waseet_order_id]);
          remote = records.find(record => recordMatchesOrder(record, order));
        } catch {
          // The edit succeeded; a failed follow-up read must not erase that fact.
        }
      }
      const updated = await ordersRepository.applyRemoteEdit(
        order.id,
        {
          ...dbUpdates,
          waseet_payload_hash: payloadHash,
          waseet_sync_state: remote ? 'synced' : 'pending',
        },
        remote,
      );
      await Promise.all([
        ordersRepository.apiLog({
          orderId: order.id,
          endpoint: 'edit-order',
          method: 'POST',
          success: true,
          durationMs: Date.now() - startedAt,
          requestId,
        }),
        ordersRepository.audit({
          orderId: order.id,
          action: 'waseet.edit',
          actorId: actor.id,
          actorUsername: actor.username,
          success: true,
          requestId,
        }),
      ]);
      return updated;
    } catch (error) {
      const originalMessage = error instanceof Error ? error.message : 'رفض الوسيط تعديل الشحنة.';
      const remoteMayHaveEdited = remoteEdited || (error instanceof WaseetApiError && error.uncertain);
      const message = remoteMayHaveEdited
        ? 'قد يكون التعديل وصل إلى الوسيط، لكن تعذر تأكيد النسخة المحلية. حدّث الشحنة من الوسيط قبل إجراء تعديل آخر.'
        : originalMessage;
      await Promise.allSettled([
        remoteMayHaveEdited
          ? ordersRepository.markDispatchFailure(order.id, message, true)
          : Promise.resolve(),
        ordersRepository.apiLog({
          orderId: order.id,
          endpoint: 'edit-order',
          method: 'POST',
          success: false,
          durationMs: Date.now() - startedAt,
          errorCode: error instanceof WaseetApiError ? error.code : undefined,
          errorMessage: message,
          requestId,
        }),
        ordersRepository.audit({
          orderId: order.id,
          action: 'waseet.edit',
          actorId: actor.id,
          actorUsername: actor.username,
          success: false,
          message,
          requestId,
          details: { remoteEdited, remoteMayHaveEdited, originalError: originalMessage },
        }),
      ]);
      throw remoteMayHaveEdited ? new Error(message) : error;
    }
  },

  async sync(orderIds: number[], actor: WaseetActor = {}, requestId: string = randomUUID()) {
    const orders = await ordersRepository.getByIds(orderIds);
    const eligible = orders.filter(order => order.waseet_order_id && order.waseet_qr_id);
    const results: Array<{ id: number; success: boolean; order?: Order; error?: string }> = [];

    for (let index = 0; index < eligible.length; index += 25) {
      const batch = eligible.slice(index, index + 25);
      const startedAt = Date.now();
      try {
        const remoteRecords = await waseetClient.getOrdersByIds(
          batch.map(order => order.waseet_order_id as string),
        );

        for (const order of batch) {
          const record = remoteRecords.find(item => recordMatchesOrder(item, order));
          if (!record) {
            const error = 'لم يُرجع الوسيط هذه الشحنة ضمن استجابة المزامنة.';
            await ordersRepository.markSyncFailure(order.id, error);
            results.push({ id: order.id, success: false, error });
            continue;
          }
          const updated = await ordersRepository.applySyncedRecord(order, record);
          results.push({ id: order.id, success: true, order: updated });
        }

        await ordersRepository.apiLog({
          endpoint: 'get-orders-by-ids-bulk',
          method: 'POST',
          success: true,
          durationMs: Date.now() - startedAt,
          requestId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'فشلت مزامنة دفعة الوسيط.';
        await Promise.all(batch.map(order => ordersRepository.markSyncFailure(order.id, message)));
        batch.forEach(order => results.push({ id: order.id, success: false, error: message }));
        await ordersRepository.apiLog({
          endpoint: 'get-orders-by-ids-bulk',
          method: 'POST',
          success: false,
          durationMs: Date.now() - startedAt,
          errorCode: error instanceof WaseetApiError ? error.code : undefined,
          errorMessage: message,
          requestId,
        });
      }
    }

    const ineligibleIds = orders
      .filter(order => !order.waseet_order_id || !order.waseet_qr_id)
      .map(order => order.id);
    ineligibleIds.forEach(id => results.push({ id, success: false, error: 'الطلب غير مرسل إلى الوسيط.' }));

    await ordersRepository.audit({
      action: 'waseet.sync-batch',
      actorId: actor.id,
      actorUsername: actor.username,
      success: results.some(result => result.success),
      requestId,
      details: {
        requested: orderIds.length,
        succeeded: results.filter(result => result.success).length,
        failed: results.filter(result => !result.success).length,
      },
    });
    return results;
  },
};
