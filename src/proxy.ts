import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard'];
const publicRoutes = ['/auth/login'];
const alwaysAllowed = [
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
  '/comparador.html',
  '/api/auth/login',
  '/api/auth/logout',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (alwaysAllowed.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isProtected = protectedRoutes.some((p) => pathname.startsWith(p));
  const isPublic = publicRoutes.some((p) => pathname.startsWith(p));

  const token = request.cookies.get('sb-access-token')?.value;

  if (isProtected) {
    if (!token) {
      const loginUrl = new URL('/auth/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.next();
      }

      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const loginUrl = new URL('/auth/login', request.url);
        return NextResponse.redirect(loginUrl);
      }

      return NextResponse.next();
    } catch {
      const loginUrl = new URL('/auth/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isPublic && token) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const dashboardUrl = new URL('/dashboard', request.url);
          return NextResponse.redirect(dashboardUrl);
        }
      }
    } catch {}
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
