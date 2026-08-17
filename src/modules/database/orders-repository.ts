import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  WaseetOrderApiRecord,
  WaseetOrderInput,
  WaseetOrderRecord,
  WaseetSyncState,
} from '@/modules/waseet/types';
import { shipmentUpdateFromWaseet } from '@/modules/waseet/order-model';

export type Order = WaseetOrderRecord;

export interface OrderListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  cityId?: number;
  regionId?: number;
  syncState?: WaseetSyncState;
  statusId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeArchived?: boolean;
}

function cleanSearch(value: string): string {
  return value.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function asOrder(data: unknown): Order {
  return data as Order;
}

export const ordersRepository = {
  async list(options: OrderListOptions = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 25));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact' })
      .order('createdAt', { ascending: false })
      .range(from, to);

    if (!options.includeArchived) query = query.neq('internal_order_state', 'archived');
    if (options.cityId) query = query.eq('waseet_city_id', options.cityId);
    if (options.regionId) query = query.eq('waseet_region_id', options.regionId);
    if (options.syncState) query = query.eq('waseet_sync_state', options.syncState);
    if (options.statusId) query = query.eq('waseet_status_id', options.statusId);
    if (options.dateFrom) query = query.gte('createdAt', `${options.dateFrom}T00:00:00.000Z`);
    if (options.dateTo) query = query.lte('createdAt', `${options.dateTo}T23:59:59.999Z`);

    const search = cleanSearch(options.search || '');
    if (search) {
      query = query.or(
        `studentName.ilike.%${search}%,phone1.ilike.%${search}%,phone2.ilike.%${search}%,receiptNumber.ilike.%${search}%,waseet_qr_id.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      orders: (data || []).map(asOrder),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
      },
    };
  },

  async listLookup(ids: number[]): Promise<Array<Pick<
    Order,
    | 'id'
    | 'studentName'
    | 'phone1'
    | 'phone2'
    | 'receiptNumber'
    | 'courseTypeId'
    | 'StudentVaultCode_ID'
    | 'StudentVaultCode_Serial'
    | 'waseet_city_name'
    | 'waseet_region_name'
    | 'address_details'
    | 'location_hint'
    | 'collection_amount'
    | 'waseet_qr_id'
    | 'waseet_status_text'
    | 'waseet_sync_state'
    | 'merchant_notes'
    | 'internal_notes'
    | 'createdAt'
  >>> {
    const uniqueIds = [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 1_000);
    if (uniqueIds.length === 0) return [];
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id,studentName,phone1,phone2,receiptNumber,courseTypeId,StudentVaultCode_ID,StudentVaultCode_Serial,waseet_city_name,waseet_region_name,address_details,location_hint,collection_amount,waseet_qr_id,waseet_status_text,waseet_sync_state,merchant_notes,internal_notes,createdAt')
      .in('id', uniqueIds);
    if (error) throw error;
    return (data || []) as Array<Pick<
      Order,
      | 'id'
      | 'studentName'
      | 'phone1'
      | 'phone2'
      | 'receiptNumber'
      | 'courseTypeId'
      | 'StudentVaultCode_ID'
      | 'StudentVaultCode_Serial'
      | 'waseet_city_name'
      | 'waseet_region_name'
      | 'address_details'
      | 'location_hint'
      | 'collection_amount'
      | 'waseet_qr_id'
      | 'waseet_status_text'
      | 'waseet_sync_state'
      | 'merchant_notes'
      | 'internal_notes'
      | 'createdAt'
    >>;
  },

  async getById(id: number): Promise<Order | null> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? asOrder(data) : null;
  },

  async getByIds(ids: number[]): Promise<Order[]> {
    const uniqueIds = [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))];
    if (uniqueIds.length === 0) return [];
    const { data, error } = await supabaseAdmin.from('orders').select('*').in('id', uniqueIds);
    if (error) throw error;
    return (data || []).map(asOrder);
  },

  async getByReceiptNumber(receiptNumber: string): Promise<Order | null> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('receiptNumber', receiptNumber)
      .neq('internal_order_state', 'archived')
      .maybeSingle();
    if (error) throw error;
    return data ? asOrder(data) : null;
  },

  async create(
    input: WaseetOrderInput,
    resolved: {
      city: { id: number; name: string };
      region: { id: number; name: string };
      packageSize: { id: number; name: string };
    },
    actor: { id?: string; username?: string },
    payloadHash: string,
  ): Promise<Order> {
    const { data, error } = await supabaseAdmin.rpc('create_waseet_order_atomic', {
      p_student_name: input.studentName,
      p_phone1: input.phone1,
      p_phone2: input.phone2 || '',
      p_waseet_city_id: resolved.city.id,
      p_waseet_city_name: resolved.city.name,
      p_waseet_region_id: resolved.region.id,
      p_waseet_region_name: resolved.region.name,
      p_address_details: input.addressDetails,
      p_location_hint: input.locationHint || '',
      p_waseet_package_size_id: resolved.packageSize.id,
      p_waseet_package_size_name: resolved.packageSize.name,
      p_collection_amount: input.collectionAmount,
      p_items_count: input.itemsCount,
      p_replacement: input.replacement,
      p_goods_type: input.goodsType,
      p_merchant_notes: input.merchantNotes || '',
      p_receipt_number: input.receiptNumber || null,
      p_course_type_id: input.courseTypeId,
      p_internal_notes: input.internalNotes || '',
      p_telegram_username: input.telegramUsername || '',
      p_created_by_id: actor.id || null,
      p_created_by_username: actor.username || '',
      p_payload_hash: payloadHash,
    });

    if (error) {
      if (/create_waseet_order_atomic/i.test(error.message || '')) {
        throw new Error('قاعدة البيانات غير محدثة. شغّل ملف Supabase-Waseet-Native-Full.sql كاملاً في SQL Editor.');
      }
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('لم تُرجع قاعدة البيانات الطلب الذي تم إنشاؤه.');
    return asOrder(row);
  },

  async updateLocal(id: number, updates: Partial<Order>): Promise<Order> {
    const safeUpdates = { ...updates, updated_at: new Date().toISOString() };
    delete (safeUpdates as Partial<Order>).id;
    delete (safeUpdates as Partial<Order>).waseet_qr_link;
    delete (safeUpdates as Partial<Order>).waseet_raw;
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(safeUpdates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return asOrder(data);
  },

  async archiveDraft(id: number, actor?: { id?: string; username?: string }): Promise<void> {
    const { error } = await supabaseAdmin.rpc('archive_waseet_order', {
      p_order_id: id,
      p_actor_id: actor?.id || null,
      p_actor_username: actor?.username || '',
    });
    if (error) throw error;
  },

  async claimDispatch(id: number, payloadHash: string): Promise<Order> {
    const { data, error } = await supabaseAdmin.rpc('claim_waseet_dispatch', {
      p_order_id: id,
      p_payload_hash: payloadHash,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('تعذر حجز محاولة الإرسال.');
    return asOrder(row);
  },

  async markDispatchSuccess(id: number, record: WaseetOrderApiRecord): Promise<Order> {
    const now = new Date().toISOString();
    const update = {
      ...shipmentUpdateFromWaseet(record),
      waseet_sync_state: 'synced',
      waseet_last_error: '',
      waseet_dispatched_at: now,
      waseet_last_synced_at: now,
      updated_at: now,
    };
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await this.appendStatusHistory(id, null, update.waseet_status_id, update.waseet_status_text, record);
    return asOrder(data);
  },

  async markDispatchFailure(id: number, message: string, needsVerification: boolean): Promise<void> {
    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        waseet_sync_state: needsVerification ? 'needs_verification' : 'failed',
        waseet_last_error: message.slice(0, 2_000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async applyRemoteEdit(id: number, updates: Partial<Order>, record?: WaseetOrderApiRecord): Promise<Order> {
    const now = new Date().toISOString();
    const finalUpdates: Partial<Order> & Record<string, unknown> = {
      ...updates,
      waseet_last_error: '',
      waseet_last_synced_at: now,
      updated_at: now,
    };
    if (record) Object.assign(finalUpdates, shipmentUpdateFromWaseet(record));
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(finalUpdates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return asOrder(data);
  },

  async applySyncedRecord(order: Order, record: WaseetOrderApiRecord): Promise<Order> {
    const now = new Date().toISOString();
    const previousStatusId = order.waseet_status_id || null;
    const update = {
      ...shipmentUpdateFromWaseet(record),
      waseet_sync_state: 'synced',
      waseet_last_error: '',
      waseet_last_synced_at: now,
      updated_at: now,
    };
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(update)
      .eq('id', order.id)
      .select('*')
      .single();
    if (error) throw error;

    if (previousStatusId !== update.waseet_status_id) {
      await this.appendStatusHistory(
        order.id,
        previousStatusId,
        update.waseet_status_id,
        update.waseet_status_text,
        record,
      );
    }
    return asOrder(data);
  },

  async markSyncFailure(id: number, message: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        waseet_sync_state: 'failed',
        waseet_last_error: message.slice(0, 2_000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async appendStatusHistory(
    orderId: number,
    previousStatusId: string | null,
    nextStatusId: string | null,
    nextStatusText: string | null,
    raw: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await supabaseAdmin.from('waseet_status_history').insert({
      order_id: orderId,
      previous_status_id: previousStatusId,
      status_id: nextStatusId,
      status_text: nextStatusText,
      raw_payload: raw,
    });
    if (error) console.error('Waseet status history log failed:', error.message);
  },

  async audit(input: {
    orderId?: number;
    action: string;
    actorId?: string;
    actorUsername?: string;
    success: boolean;
    message?: string;
    details?: Record<string, unknown>;
    requestId?: string;
  }): Promise<void> {
    const { error } = await supabaseAdmin.from('waseet_audit_log').insert({
      order_id: input.orderId || null,
      action: input.action,
      actor_id: input.actorId || null,
      actor_username: input.actorUsername || '',
      success: input.success,
      message: input.message || '',
      details: input.details || {},
      request_id: input.requestId || null,
    });
    if (error) console.error('Waseet audit log failed:', error.message);
  },

  async apiLog(input: {
    orderId?: number;
    endpoint: string;
    method: string;
    success: boolean;
    durationMs: number;
    errorCode?: string;
    errorMessage?: string;
    requestId?: string;
  }): Promise<void> {
    const { error } = await supabaseAdmin.from('waseet_api_log').insert({
      order_id: input.orderId || null,
      endpoint: input.endpoint,
      method: input.method,
      success: input.success,
      duration_ms: input.durationMs,
      error_code: input.errorCode || null,
      error_message: input.errorMessage || '',
      request_id: input.requestId || null,
    });
    if (error) console.error('Waseet API log failed:', error.message);
  },

  async getNextReceiptNumber(): Promise<string> {
    const { data, error } = await supabaseAdmin.rpc('preview_next_receipt_number');
    if (error) throw error;
    return String(data || '1001');
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Order[]> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .gte('createdAt', `${startDate}T00:00:00.000Z`)
      .lte('createdAt', `${endDate}T23:59:59.999Z`)
      .neq('internal_order_state', 'archived')
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []).map(asOrder);
  },

  async statistics() {
    const [{ count: total }, { count: sent }, { count: manualReview }, { data: amounts }] = await Promise.all([
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).neq('internal_order_state', 'archived'),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).not('waseet_qr_id', 'is', null).neq('internal_order_state', 'archived'),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('waseet_sync_state', 'manual_review').neq('internal_order_state', 'archived'),
      supabaseAdmin.from('orders').select('collection_amount,waseet_merchant_price').neq('internal_order_state', 'archived'),
    ]);
    return {
      totalOrders: total || 0,
      sentOrders: sent || 0,
      manualReviewOrders: manualReview || 0,
      collectionTotal: (amounts || []).reduce((sum: number, row: { collection_amount?: unknown }) => sum + Number(row.collection_amount || 0), 0),
      merchantNetTotal: (amounts || []).reduce((sum: number, row: { waseet_merchant_price?: unknown }) => sum + Number(row.waseet_merchant_price || 0), 0),
    };
  },
};
