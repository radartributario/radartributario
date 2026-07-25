import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ msg: "use POST to test" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: key!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.text();
    return NextResponse.json({
      status: res.status,
      email,
      bodyPreview: data.substring(0, 100),
    });
  } catch (e: unknown) {
    return NextResponse.json({
      error: `erro: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}
