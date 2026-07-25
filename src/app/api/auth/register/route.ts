import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`,
      {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          data: { full_name: name },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.msg || "Erro ao cadastrar" },
        { status: 400 }
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Erro de conexão" },
      { status: 500 }
    );
  }
}
