import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// GET /api/settings - Get system settings (returns settings object directly)
export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const settings = await db.getSettings();
    
    // Return settings directly (not wrapped in object)
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Get Settings Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في جلب الإعدادات' },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update system settings (Admin only)
export async function PUT(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { requestTemplate, confirmationTemplate, defaultOrderNote } = await req.json();

    await db.updateSettings({
      requestTemplate,
      confirmationTemplate,
      defaultOrderNote
    });

    // Return updated settings directly
    const updatedSettings = await db.getSettings();
    
    return NextResponse.json({
      success: true,
      ...updatedSettings,
      message: 'تم تحديث الإعدادات بنجاح'
    });
  } catch (error: any) {
    console.error('Update Settings Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في تحديث الإعدادات' },
      { status: 500 }
    );
  }
}
