import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'J6K93m0LP4mtat0gPNyemG8TZVjtuqKOFYsma16oFBnSfHYn7a8W9Yg0+McRXuYqGca77zEJV3Ug1RS8jNAs9w=='
);

export interface SessionUser {
  id: string;
  username: string;
  role: 'admin' | 'agent';
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return token;
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      username: payload.username as string,
      role: payload.role as 'admin' | 'agent'
    };
  } catch {
    return null;
  }
}

import { NextRequest, NextResponse } from 'next/server';

export function setSessionCookie(response: NextResponse, user: SessionUser): void {
  response.cookies.set('session', JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });
}

export function deleteSessionCookie(response: NextResponse): void {
  response.cookies.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });
}

// Alias for backward compatibility
export const clearSessionCookie = deleteSessionCookie;

export function getSessionUser(req: NextRequest): SessionUser | null {
  const sessionCookie = req.cookies.get('session');
  if (!sessionCookie) return null;
  
  try {
    return JSON.parse(sessionCookie.value) as SessionUser;
  } catch {
    return null;
  }
}
