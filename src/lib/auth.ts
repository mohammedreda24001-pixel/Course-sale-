import bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEVELOPMENT_SECRET = 'course-sale-local-development-secret-change-before-production';

export interface SessionUser {
  id: string;
  username: string;
  role: 'admin' | 'agent';
}

interface SessionPayload extends SessionUser {
  iat: number;
  exp: number;
}

function getSessionSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    if (process.env.NODE_ENV === 'production' && configured.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters in production.');
    }
    return configured;
  }
  if (process.env.NODE_ENV !== 'production') return DEVELOPMENT_SECRET;
  throw new Error('JWT_SECRET must be configured in the production environment.');
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
}

function createSignedSession(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function parseSignedSession(token: string): SessionUser | null {
  try {
    const [encodedPayload, providedSignature, extra] = token.split('.');
    if (!encodedPayload || !providedSignature || extra !== undefined) return null;

    const expectedSignature = sign(encodedPayload);
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const providedBuffer = Buffer.from(providedSignature, 'utf8');
    if (
      expectedBuffer.length !== providedBuffer.length
      || !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<SessionPayload>;

    if (
      typeof payload.id !== 'string'
      || typeof payload.username !== 'string'
      || (payload.role !== 'admin' && payload.role !== 'agent')
      || typeof payload.exp !== 'number'
      || payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { id: payload.id, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Retained for the server-rendered root page and any older internal callers.
export async function createSessionToken(user: SessionUser): Promise<string> {
  return createSignedSession(user);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  return parseSignedSession(token);
}

export function setSessionCookie(response: NextResponse, user: SessionUser): void {
  response.cookies.set(SESSION_COOKIE, createSignedSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });
}

export function deleteSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export const clearSessionCookie = deleteSessionCookie;

export function getSessionUser(req: NextRequest): SessionUser | null {
  const sessionCookie = req.cookies.get(SESSION_COOKIE);
  return sessionCookie ? parseSignedSession(sessionCookie.value) : null;
}
