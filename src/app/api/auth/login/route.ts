import { NextResponse } from "next/server";

// Simple in-memory brute-force protection.
// Sempre que NODE_ENV === "production" o limite é aplicado; em dev também,
// para manter comportamento consistente entre ambientes.
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 30_000;
const MAX_TRACKED_KEYS = 10_000;

const attempts = new Map<string, { count: number; blockedUntil: number }>();

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return `ip:${ip}`;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return `ip:${real}`;
  return "ip:unknown";
}

function pruneExpired(now: number): void {
  if (attempts.size < MAX_TRACKED_KEYS) return;
  const keys: string[] = [];
  for (const [k, v] of attempts) {
    if (v.blockedUntil <= now && v.count === 0) keys.push(k);
  }
  for (const k of keys) attempts.delete(k);
}

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

  const key = clientKey(req);
  const now = Date.now();
  const current = attempts.get(key);

  if (current && current.blockedUntil > now) {
    const retryAfter = Math.max(1, Math.ceil((current.blockedUntil - now) / 1000));
    return NextResponse.json(
      {
        error: `Muitas tentativas de login. Tente novamente em ${retryAfter} segundo${retryAfter === 1 ? "" : "s"}.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  pruneExpired(now);

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyApi = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !keyApi) {
    return NextResponse.json({ error: "Configuração ausente" }, { status: 500 });
  }

  const registerFailure = () => {
    const prev = attempts.get(key);
    const base = prev && prev.blockedUntil <= now ? 0 : prev?.count ?? 0;
    const nextCount = base + 1;
    if (nextCount >= MAX_ATTEMPTS) {
      attempts.set(key, { count: 0, blockedUntil: now + BLOCK_MS });
    } else {
      attempts.set(key, { count: nextCount, blockedUntil: 0 });
    }
  };

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: keyApi,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      registerFailure();
      return NextResponse.json(
        { error: data.msg || data.error_description || "Credenciais inválidas" },
        { status: 400 }
      );
    }

    // Sucesso: limpa o contador do cliente
    attempts.delete(key);

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