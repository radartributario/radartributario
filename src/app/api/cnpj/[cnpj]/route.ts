import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const MAX_REQUESTS_PER_IP = 30; // por janela
const WINDOW_MS = 60 * 1000; // 1 minuto

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const usage = new Map<string, number[]>();

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return `ip:${ip}`;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return `ip:${real}`;
  return "ip:unknown";
}

function isRateLimited(key: string, now: number): boolean {
  const list = (usage.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_REQUESTS_PER_IP) {
    usage.set(key, list);
    return true;
  }
  list.push(now);
  usage.set(key, list);
  if (usage.size > 5000) {
    for (const [k, v] of usage) {
      if (v.every((t) => now - t >= WINDOW_MS)) usage.delete(k);
    }
  }
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  const { cnpj } = await params;
  const clean = cnpj.replace(/\D/g, "");

  if (clean.length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }

  const key = clientKey(req);
  const now = Date.now();

  if (isRateLimited(key, now)) {
    return NextResponse.json(
      { error: "Muitas consultas. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  const cached = cache.get(clean);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      headers: {
        "User-Agent": "CompareTributo/1.0",
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || "Erro ao consultar CNPJ" },
        { status: res.status }
      );
    }
    const data = await res.json();
    cache.set(clean, { data, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json(data, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erro de conexão com a API" },
      { status: 502 }
    );
  }
}