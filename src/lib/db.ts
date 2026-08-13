import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyPassword, hashPassword } from '@/lib/auth';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'agent';
  passwordHash: string;
  createdAt?: string;
}

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
  createdAt: string;
}

export interface Code {
  id: string;
  codeValue: string;
  serialNumber: string;
  status: 'available' | 'used';
  orderId?: number;
  assignedAt?: string;
  courseTypeId?: number;
  isDisabled: boolean;
  createdAt?: string;
}

export interface CourseType {
  id: number;
  name: string;
  defaultPrice: number;
}

export const db = {
  // Authentication
  async authenticateUser(username: string, password: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) return null;

    const isValid = await verifyPassword(password, data.passwordHash);
    if (!isValid) return null;

    return {
      id: data.id,
      username: data.username,
      role: data.role,
      passwordHash: data.passwordHash
    };
  },

  async getUserById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, role')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data;
  },

  // Users (Admin only)
  async getUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, role, createdAt')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createUser(username: string, password: string, role: 'admin' | 'agent'): Promise<User> {
    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();

    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([{ id, username, passwordHash, role }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Orders - Returns array directly for API compatibility
  async getOrders(limit?: number, _offset?: number): Promise<Order[]> {
    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .order('createdAt', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getOrderById(id: number): Promise<Order | null> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data;
  },

  async createOrder(input: {
    studentName: string;
    phone1: string;
    phone2: string;
    province: string;
    address: string;
    landmark: string;
    createdBy: { id: string; username: string };
    piecesCount: number;
    hasReturn: string;
    goodsType: string;
    returnDescription: string;
    receiptNumber?: string;
    notes: string;
    manualCode?: string;
    manualSerial?: string;
    courseTypeId: number;
    internalNotes: string;
    telegramUsername: string;
    statusId: number;
    basePrice: number;
    deliveryFee: number;
  }): Promise<Order> {
    const { data, error } = await supabaseAdmin.rpc('create_order_atomic', {
      p_student_name: input.studentName,
      p_phone1: input.phone1,
      p_phone2: input.phone2,
      p_province: input.province,
      p_address: input.address,
      p_landmark: input.landmark,
      p_created_by_id: input.createdBy.id,
      p_created_by_username: input.createdBy.username,
      p_pieces_count: input.piecesCount,
      p_has_return: input.hasReturn,
      p_goods_type: input.goodsType,
      p_return_description: input.returnDescription,
      p_receipt_number: input.receiptNumber?.trim() || null,
      p_notes: input.notes,
      p_manual_code: input.manualCode?.trim() || null,
      p_manual_serial: input.manualSerial?.trim() || null,
      p_course_type_id: input.courseTypeId,
      p_internal_notes: input.internalNotes,
      p_telegram_username: input.telegramUsername,
      p_status_id: input.statusId,
      p_base_price: input.basePrice,
      p_delivery_fee: input.deliveryFee
    });

    if (error) throw error;
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) throw new Error('فشل إنشاء الطلب.');
    return order as Order;
  },

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrderStatus(id: number, statusId: number): Promise<Order> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ statusId })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteOrder(id: number): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;
    return Boolean(data && data.length > 0);
  },

  // Codes
  async getCodes(filters?: { status?: string; courseId?: number }): Promise<Code[]> {
    let query = supabaseAdmin
      .from('codes')
      .select('*')
      .order('createdAt', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.courseId) query = query.eq('courseTypeId', filters.courseId);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Course Types
  async getCourseTypes(): Promise<CourseType[]> {
    const { data, error } = await supabaseAdmin
      .from('course_types')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createCourseType(name: string, defaultPrice: number): Promise<CourseType> {
    const { data, error } = await supabaseAdmin
      .from('course_types')
      .insert([{ name, defaultPrice }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Settings
  async getSettings(): Promise<{ requestTemplate: string; confirmationTemplate: string; defaultOrderNote: string }> {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('requestTemplate, confirmationTemplate, defaultOrderNote')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return {
        requestTemplate: '',
        confirmationTemplate: '',
        defaultOrderNote: ''
      };
    }
    return data;
  },

  async updateSettings(settings: { requestTemplate?: string; confirmationTemplate?: string; defaultOrderNote?: string }): Promise<void> {
    const { error } = await supabaseAdmin
      .from('settings')
      .update(settings)
      .eq('id', 1);

    if (error) throw error;
  },

  // Statistics
  async getOrderStatistics(): Promise<{
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
  },

  // Next Receipt Number
  async getNextReceiptNumber(): Promise<string> {
    const { data, error } = await supabaseAdmin.rpc('preview_next_receipt_number');
    if (error) throw error;
    return String(data);
  },

  // Get orders by date range for statistics
  async getOrdersByDateRange(startDate: string, endDate: string): Promise<Order[]> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .gte('createdAt', startDate)
      .lte('createdAt', endDate + 'T23:59:59.999Z')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};
