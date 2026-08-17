import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyPassword, hashPassword } from '@/lib/auth';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'agent';
  passwordHash: string;
  createdAt?: string;
}

export interface CourseType {
  id: number;
  name: string;
  defaultPrice: number;
}

export interface AppSettings {
  requestTemplate: string;
  confirmationTemplate: string;
  defaultOrderNote: string;
}

export const db = {
  async authenticateUser(username: string, password: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id,username,role,passwordHash,createdAt')
      .eq('username', username.trim())
      .maybeSingle();

    if (error || !data) return null;
    if (!(await verifyPassword(password, String(data.passwordHash)))) return null;

    return {
      id: String(data.id),
      username: String(data.username),
      role: data.role as User['role'],
      passwordHash: String(data.passwordHash),
      createdAt: data.createdAt ? String(data.createdAt) : undefined,
    };
  },

  async getUsers(): Promise<Array<Omit<User, 'passwordHash'>>> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id,username,role,createdAt')
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      username: String(row.username),
      role: row.role as User['role'],
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
    }));
  },

  async createUser(username: string, password: string, role: User['role']): Promise<User> {
    const passwordHash = await hashPassword(password);
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({ id: randomUUID(), username: username.trim(), passwordHash, role })
      .select('id,username,role,passwordHash,createdAt')
      .single();
    if (error) throw error;
    return data as User;
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  async getCourseTypes(): Promise<CourseType[]> {
    const { data, error } = await supabaseAdmin
      .from('course_types')
      .select('id,name,defaultPrice')
      .order('name');
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.name),
      defaultPrice: Number(row.defaultPrice || 0),
    }));
  },

  async createCourseType(name: string, defaultPrice: number): Promise<CourseType> {
    const { data, error } = await supabaseAdmin
      .from('course_types')
      .insert({ name: name.trim(), defaultPrice })
      .select('id,name,defaultPrice')
      .single();
    if (error) throw error;
    return {
      id: Number(data.id),
      name: String(data.name),
      defaultPrice: Number(data.defaultPrice || 0),
    };
  },

  async updateCourseType(id: number, name: string, defaultPrice: number): Promise<CourseType> {
    const { data, error } = await supabaseAdmin
      .from('course_types')
      .update({ name: name.trim(), defaultPrice })
      .eq('id', id)
      .select('id,name,defaultPrice')
      .single();
    if (error) throw error;
    return {
      id: Number(data.id),
      name: String(data.name),
      defaultPrice: Number(data.defaultPrice || 0),
    };
  },

  async deleteCourseType(id: number): Promise<void> {
    const { error } = await supabaseAdmin.from('course_types').delete().eq('id', id);
    if (error) throw error;
  },

  async getSettings(): Promise<AppSettings> {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('requestTemplate,confirmationTemplate,defaultOrderNote')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      return { requestTemplate: '', confirmationTemplate: '', defaultOrderNote: '' };
    }
    return {
      requestTemplate: String(data.requestTemplate || ''),
      confirmationTemplate: String(data.confirmationTemplate || ''),
      defaultOrderNote: String(data.defaultOrderNote || ''),
    };
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({ id: 1, ...settings }, { onConflict: 'id' });
    if (error) throw error;
  },
};
