import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = body.email || "";
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Configuração ausente" }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.msg || data.error_description || "Credenciais inválidas" },
        { status: 400 }
      );
    }

    // Set HttpOnly cookies instead of returning tokens to client JS
    const response = NextResponse.json({ success: true });

    if (data.access_token) {
      response.cookies.set("sb-access-token", data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      });
    }

    if (data.refresh_token) {
      response.cookies.set("sb-refresh-token", data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 86400 * 30,
      });
    }

    return response;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Erro ao conectar: ${e instanceof Error ? e.message : "desconhecido"}` },
      { status: 500 }
    );
  }
}
