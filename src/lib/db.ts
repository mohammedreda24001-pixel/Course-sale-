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

  async createOrder(
    studentName: string,
    phone1: string,
    phone2: string,
    province: string,
    address: string,
    landmark: string,
    totalPrice: number,
    createdBy: { id: string; username: string },
    piecesCount: number,
    hasReturn: string,
    goodsType: string,
    returnDescription: string,
    receiptNumber: string,
    notes: string,
    manualCode?: string,
    manualSerial?: string,
    courseTypeId?: number,
    internalNotes?: string,
    telegramUsername?: string,
    statusId?: number,
    basePrice?: number,
    deliveryFee?: number
  ): Promise<Order> {
    // First, try to find an available code for this course type
    let codeValue = manualCode || 'PENDING';
    let serialNumber = manualSerial || 'PENDING';

    if (!manualCode) {
      const { data: availableCode } = await supabaseAdmin
        .from('codes')
        .select('*')
        .eq('status', 'available')
        .eq('isDisabled', false)
        .eq('courseTypeId', courseTypeId || 1)
        .limit(1)
        .single();

      if (availableCode) {
        codeValue = availableCode.codeValue;
        serialNumber = availableCode.serialNumber;

        // Mark the code as used
        await supabaseAdmin
          .from('codes')
          .update({
            status: 'used',
            orderId: null, // Will be set after order creation
            assignedAt: new Date().toISOString()
          })
          .eq('id', availableCode.id);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert([{
        studentName,
        phone1,
        phone2,
        province,
        address,
        landmark,
        totalPrice,
        basePrice: basePrice || 250,
        deliveryFee: deliveryFee || 0,
        StudentVaultCode_ID: codeValue,
        StudentVaultCode_Serial: serialNumber,
        createdById: createdBy.id,
        createdByUsername: createdBy.username,
        piecesCount: piecesCount || 1,
        hasReturn: hasReturn || 'لا',
        goodsType: goodsType || 'كورس تعليمي',
        returnDescription: returnDescription || '',
        receiptNumber: receiptNumber || '',
        notes: notes || '',
        courseTypeId: courseTypeId || 1,
        internalNotes: internalNotes || '',
        telegramUsername: telegramUsername || '',
        statusId: statusId || 1
      }])
      .select()
      .single();

    if (error) throw error;

    // If we used a code, update it with the order ID
    if (!manualCode && codeValue !== 'PENDING') {
      await supabaseAdmin
        .from('codes')
        .update({ orderId: data.id })
        .eq('codeValue', codeValue);
    }

    return data;
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
    // Get the order to free up the code
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('StudentVaultCode_ID')
      .eq('id', id)
      .single();

    // Delete the order
    const { error } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) throw false;

    // Free up the code if it was assigned
    if (order && order.StudentVaultCode_ID && order.StudentVaultCode_ID !== 'PENDING') {
      await supabaseAdmin
        .from('codes')
        .update({
          status: 'available',
          orderId: null,
          assignedAt: null
        })
        .eq('codeValue', order.StudentVaultCode_ID);
    }

    return true;
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

  async createCode(code: Omit<Code, 'id' | 'createdAt'>): Promise<Code> {
    const id = crypto.randomUUID();
    const { data, error } = await supabaseAdmin
      .from('codes')
      .insert([{ ...code, id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async assignCodeToOrder(codeId: string, orderId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('codes')
      .update({
        status: 'used',
        orderId,
        assignedAt: new Date().toISOString()
      })
      .eq('id', codeId);

    if (error) throw error;
  },

  async toggleCodeDisabled(codeId: string, isDisabled: boolean): Promise<void> {
    const { error } = await supabaseAdmin
      .from('codes')
      .update({ isDisabled })
      .eq('id', codeId);

    if (error) throw error;
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
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('receiptNumber')
      .not('receiptNumber', 'is', null)
      .order('receiptNumber', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return '1001';
    }

    const lastNumber = parseInt(data[0].receiptNumber);
    return String(lastNumber + 1);
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
