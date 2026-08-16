import { supabaseAdmin } from '@/lib/supabase/admin';

export interface OrderSupport {
  id: number;
  orderId: number;
  type: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface Settings {
  requestTemplate: string;
  confirmationTemplate: string;
  defaultOrderNote: string;
}

export interface CourseType {
  id: number;
  name: string;
  defaultPrice: number;
}

export const orderSupportRepository = {
  async getByOrderId(orderId: number): Promise<OrderSupport[]> {
    const { data, error } = await supabaseAdmin
      .from('order_support')
      .select('*')
      .eq('orderId', orderId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(supportData: Omit<OrderSupport, 'id' | 'createdAt'>): Promise<OrderSupport> {
    const { data, error } = await supabaseAdmin
      .from('order_support')
      .insert([supportData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: number, updates: Partial<OrderSupport>): Promise<OrderSupport> {
    const { data, error } = await supabaseAdmin
      .from('order_support')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getSettings(): Promise<Settings> {
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

  async getCourseTypes(): Promise<CourseType[]> {
    const { data, error } = await supabaseAdmin
      .from('course_types')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async updateSettings(settings: Partial<Settings>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('settings')
      .update(settings)
      .eq('id', 1);

    if (error) throw error;
  }
};
