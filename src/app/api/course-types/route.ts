import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// GET /api/course-types - List all course types
export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const courseTypes = await db.getCourseTypes();
    
    return NextResponse.json({ courseTypes });
  } catch (error: any) {
    console.error('Get Course Types Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في جلب أنواع الدورات' },
      { status: 500 }
    );
  }
}

// POST /api/course-types - Create new course type (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { name, defaultPrice } = await req.json();

    if (!name || !defaultPrice) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم الدورة والسعر الافتراضي' },
        { status: 400 }
      );
    }

    const courseType = await db.createCourseType(name, Number(defaultPrice));
    
    return NextResponse.json({
      success: true,
      courseType
    });
  } catch (error: any) {
    console.error('Create Course Type Error:', error);
    
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'نوع الدورة موجود مسبقاً' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'حدث خطأ في إنشاء نوع الدورة' },
      { status: 500 }
    );
  }
}
