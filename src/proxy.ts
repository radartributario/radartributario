import { type NextRequest, NextResponse } from "next/server";

export async function proxy(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname;
    const isAuthPage = path.startsWith("/auth/login") || path.startsWith("/auth/register");

    if (path.startsWith("/dashboard")) {
      const token = req.cookies.get("sb-access-token")?.value;

      if (!token) {
        return NextResponse.redirect(new URL("/auth/login", req.url));
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        return NextResponse.redirect(new URL("/auth/login", req.url));
      }
    }

    if (isAuthPage) {
      const token = req.cookies.get("sb-access-token")?.value;
      if (token) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (res.ok) {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
      }
    }

    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
