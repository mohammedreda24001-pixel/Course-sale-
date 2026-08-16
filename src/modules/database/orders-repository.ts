import { supabaseAdmin } from '@/lib/supabase/admin';

export interface Order {
  id: number;
  studentName: string;
  phone1: string;
  phone2?: string;
  province: string;
  address: string;
  landmark: string;
  totalPrice: number;
  basePrice?: number;
  deliveryFee?: number;
  StudentVaultCode_ID: string;
  StudentVaultCode_Serial: string;
  createdById?: string;
  createdByUsername?: string;
  piecesCount?: number;
  hasReturn?: string;
  goodsType?: string;
  returnDescription?: string;
  receiptNumber?: string;
  ShipmentTrackingCode?: string;
  notes?: string;
  courseTypeId?: number;
  internalNotes?: string;
  telegramUsername?: string;
  statusId?: number;
  region?: string;
  packageSize?: string;
  createdAt: string;
}

export const ordersRepository = {
  async list(): Promise<Order[]> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: number): Promise<Order | null> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data;
  },

  async getByReceiptNumber(receiptNumber: string): Promise<Order | null> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('receiptNumber', receiptNumber)
      .single();

    if (error || !data) return null;
    return data;
  },

  async create(orderData: any): Promise<Order> {
    // Try atomic function first (Phase 2)
    try {
      const { data, error } = await supabaseAdmin.rpc('create_order_atomic', {
        p_student_name: orderData.studentName,
        p_phone1: orderData.phone1,
        p_phone2: orderData.phone2 || '',
        p_province: orderData.province,
        p_address: orderData.address,
        p_landmark: orderData.landmark || '',
        p_created_by_id: orderData.createdById || '',
        p_created_by_username: orderData.createdByUsername || '',
        p_pieces_count: orderData.piecesCount || 1,
        p_has_return: orderData.hasReturn || 'لا',
        p_goods_type: orderData.goodsType || 'كورس تعليمي',
        p_return_description: orderData.returnDescription || '',
        p_receipt_number: orderData.receiptNumber?.trim() || null,
        p_notes: orderData.notes || '',
        p_manual_code: undefined,
        p_manual_serial: undefined,
        p_course_type_id: orderData.courseTypeId || 1,
        p_internal_notes: orderData.internalNotes || '',
        p_telegram_username: orderData.telegramUsername || '',
        p_status_id: orderData.statusId || 1,
        p_base_price: orderData.basePrice || 250,
        p_delivery_fee: orderData.deliveryFee || 0
      });

      if (!error && data) {
        const order = Array.isArray(data) ? data[0] : data;
        if (order) return order as Order;
      }
    } catch {
      // Atomic function not available - use fallback
    }

    // Fallback: Simple insert without atomic code reservation
    return this.createOrderFallback(orderData);
  },

  // Fallback method for when create_order_atomic RPC doesn't exist yet
  private async createOrderFallback(orderData: any): Promise<Order> {
    // Get next receipt number
    let receiptNumber = orderData.receiptNumber?.trim();
    if (!receiptNumber) {
      receiptNumber = await this.getNextReceiptNumber();
    }

    // Get an available code from vault
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('codes')
      .select('*')
      .eq('status', 'available')
      .eq('courseTypeId', orderData.courseTypeId || 1)
      .limit(1);

    if (codeError || !codeData || codeData.length === 0) {
      throw new Error('لا توجد أكواد متاحة في المخزن. يرجى إضافة أكواد أولاً.');
    }

    const selectedCode = codeData[0];

    // Mark code as used
    const { error: updateCodeError } = await supabaseAdmin
      .from('codes')
      .update({ 
        status: 'used',
        orderId: 'pending-insert'
      })
      .eq('id', selectedCode.id);

    if (updateCodeError) {
      throw new Error('فشل حجز الكود. يرجى المحاولة مرة أخرى.');
    }

    // Create the order
    const orderInsert = {
      studentName: orderData.studentName,
      phone1: orderData.phone1,
      phone2: orderData.phone2 || '',
      province: orderData.province,
      address: orderData.address,
      landmark: orderData.landmark || '',
      totalPrice: orderData.totalPrice || (orderData.basePrice || 250) + (orderData.deliveryFee || 0),
      basePrice: orderData.basePrice || 250,
      deliveryFee: orderData.deliveryFee || 0,
      StudentVaultCode_ID: selectedCode.codeValue,
      StudentVaultCode_Serial: selectedCode.serialNumber || '',
      createdById: orderData.createdById,
      createdByUsername: orderData.createdByUsername,
      piecesCount: orderData.piecesCount || 1,
      hasReturn: orderData.hasReturn || 'لا',
      goodsType: orderData.goodsType || 'كورس تعليمي',
      returnDescription: orderData.returnDescription || '',
      receiptNumber,
      notes: orderData.notes || '',
      courseTypeId: orderData.courseTypeId || 1,
      internalNotes: orderData.internalNotes || '',
      telegramUsername: orderData.telegramUsername || '',
      statusId: orderData.statusId || 1,
      region: orderData.region || '',
      packageSize: orderData.packageSize || ''
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderInsert)
      .select()
      .single();

    if (orderError) {
      // Rollback: release the code
      await supabaseAdmin
        .from('codes')
        .update({ status: 'available', orderId: null })
        .eq('id', selectedCode.id);
      throw new Error(`فشل إنشاء الطلب: ${orderError.message}`);
    }

    // Update code with actual order ID
    await supabaseAdmin
      .from('codes')
      .update({ orderId: order.id })
      .eq('id', selectedCode.id);

    return order as Order;
  },

  async update(id: number, updates: Partial<Order>): Promise<Order> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Alias for delete
  async remove(id: number): Promise<boolean> {
    return this.delete(id);
  },

  // Alias for updateOrderStatus
  async updateStatus(id: number, statusId: number): Promise<Order> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ statusId })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getNextReceiptNumber(): Promise<string> {
    try {
      // Try using the preview function first
      const { data, error } = await supabaseAdmin.rpc('preview_next_receipt_number');
      
      if (!error && data) {
        return String(data);
      }
    } catch {
      // Fallback to manual calculation
    }

    // Fallback: get max receipt number
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('receiptNumber')
      .not('receiptNumber', 'is', null)
      .neq('receiptNumber', '')
      .order('receiptNumber', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return '1001';
    }

    const lastNumber = parseInt(data[0].receiptNumber);
    return String(lastNumber + 1);
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Order[]> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .gte('createdAt', startDate)
      .lte('createdAt', endDate + 'T23:59:59.999Z')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getStatistics(): Promise<{
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    deliveredOrders: number;
  }> {
    const { count: totalOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { data: revenueData } = await supabaseAdmin
      .from('orders')
      .select('totalPrice');

    const totalRevenue = revenueData?.reduce((sum, order) => sum + Number(order.totalPrice), 0) || 0;

    const { count: pendingOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('statusId', [1, 3]);

    const { count: deliveredOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('statusId', 2);

    return {
      totalOrders: totalOrders || 0,
      totalRevenue,
      pendingOrders: pendingOrders || 0,
      deliveredOrders: deliveredOrders || 0
    };
  }
};
