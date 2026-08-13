import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم المستخدم وكلمة المرور' },
        { status: 400 }
      );
    }

    const user = await db.authenticateUser(username, password);
    if (!user) {
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

    setSessionCookie(response, {
      id: user.id,
      username: user.username,
      role: user.role
    });

    return response;
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء تسجيل الدخول' },
      { status: 500 }
    );
  }
}
