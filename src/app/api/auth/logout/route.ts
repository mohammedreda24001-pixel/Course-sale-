import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  clearSessionCookie(response);
  return response;
}
