import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasUrl = !!url;
  const hasKey = !!key;
  const urlPrefix = url ? url.substring(0, 20) + "..." : "undefined";

  let supabaseOk = false;
  let supabaseMsg = "";
  if (url && key) {
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
      });
      supabaseOk = res.ok;
      supabaseMsg = `HTTP ${res.status}`;
    } catch (e: unknown) {
      supabaseMsg = `Erro: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    hasUrl,
    hasKey,
    urlPrefix,
    supabaseOk,
    supabaseMsg,
    node: process.version,
  });
}
