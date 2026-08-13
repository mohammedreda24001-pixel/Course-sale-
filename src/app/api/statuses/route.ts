import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth';

// GET /api/statuses - List all order statuses (returns array directly)
export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('order_statuses')
      .select('*')
      .order('id');

    if (error) throw error;
    
    // Return array directly (not wrapped in object)
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Get Statuses Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في جلب حالات الطلبات' },
      { status: 500 }
    );
  }
}
