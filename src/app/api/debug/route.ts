import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let loginTest = "";
  if (url && key) {
    try {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "rafael.carvalho100@yahoo.com",
          password: "Salmos83/18",
        }),
      });
      const data = await res.text();
      loginTest = `HTTP ${res.status}: ${data.substring(0, 200)}`;
    } catch (e: unknown) {
      loginTest = `Erro: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    url: url ? url.substring(0, 30) + "..." : "undefined",
    key: key ? key.substring(0, 20) + "..." : "undefined",
    loginTest,
  });
}
