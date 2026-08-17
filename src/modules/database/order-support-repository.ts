import { supabaseAdmin } from '@/lib/supabase/admin';

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
        defaultOrderNote: '',
      };
    }
    return data as Settings;
  },

  async getCourseTypes(): Promise<CourseType[]> {
    const { data, error } = await supabaseAdmin
      .from('course_types')
      .select('id, name, defaultPrice')
      .order('name');

    if (error) throw error;
    return (data || []) as CourseType[];
  },
};
