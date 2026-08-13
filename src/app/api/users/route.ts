import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// GET /api/users - List all users (Admin only)
export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const users = await db.getUsers();
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Get Users Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في جلب المستخدمين' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { username, password, role } = await req.json();

    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'يرجى ملء جميع الحقول المطلوبة' },
        { status: 400 }
      );
    }

    if (!['admin', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: 'دور المستخدم غير صالح' },
        { status: 400 }
      );
    }

    const newUser = await db.createUser(username, password, role);
    
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role
      }
    });
  } catch (error: any) {
    console.error('Create User Error:', error);
    
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'اسم المستخدم موجود مسبقاً' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'حدث خطأ في إنشاء المستخدم' },
      { status: 500 }
    );
  }
}

// DELETE /api/users - Delete user (Admin only)
export async function DELETE(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { error: 'يرجى تحديد معرف المستخدم' },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'لا يمكنك حذف حسابك الخاص' },
        { status: 400 }
      );
    }

    await db.deleteUser(userId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete User Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في حذف المستخدم' },
      { status: 500 }
    );
  }
}
