import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// GET /api/products - List all products (returns array directly)
export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // Using course_types as products for now
    const products = await db.getCourseTypes();
    
    // Return array directly (not wrapped in object)
    return NextResponse.json(products.map(p => ({ id: p.id, name: p.name })));
  } catch (error: any) {
    console.error('Get Products Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في جلب المنتجات' },
      { status: 500 }
    );
  }
}
