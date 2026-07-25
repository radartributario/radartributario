import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  try {
    const res = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              req.cookies.set(name, value);
            }
            for (const { name, value, options } of cookiesToSet) {
              res.cookies.set(name, value, options);
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    const path = req.nextUrl.pathname;

    const isAuthPage = path.startsWith("/auth/login") || path.startsWith("/auth/register");

    if (path.startsWith("/dashboard") && !user) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    if (user && isAuthPage) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return res;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
