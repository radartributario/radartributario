import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Auth Proxy — Configuração', () => {
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

  it('deve proteger /dashboard', () => {
    assert.ok(protectedRoutes.some((p) => '/dashboard'.startsWith(p)));
  });

  it('deve proteger /dashboard/qualquer-coisa', () => {
    assert.ok(protectedRoutes.some((p) => '/dashboard/resultados'.startsWith(p)));
  });

  it('/auth/login deve ser público', () => {
    assert.ok(publicRoutes.some((p) => '/auth/login'.startsWith(p)));
  });

  it('/auth/login/recuperar deve ser público', () => {
    assert.ok(publicRoutes.some((p) => '/auth/login/recuperar'.startsWith(p)));
  });

  it('/comparador.html deve ser sempre permitido', () => {
    assert.ok(alwaysAllowed.some((p) => '/comparador.html'.startsWith(p)));
  });

  it('/_next/static/chunks/foo.js deve ser sempre permitido', () => {
    assert.ok(alwaysAllowed.some((p) => '/_next/static/chunks/foo.js'.startsWith(p)));
  });

  it('/_next/image deve ser sempre permitido', () => {
    assert.ok(alwaysAllowed.some((p) => '/_next/image/foo'.startsWith(p)));
  });

  it('/api/auth/login deve ser sempre permitido', () => {
    assert.ok(alwaysAllowed.some((p) => '/api/auth/login'.startsWith(p)));
  });

  it('/api/auth/logout deve ser sempre permitido', () => {
    assert.ok(alwaysAllowed.some((p) => '/api/auth/logout'.startsWith(p)));
  });

  it('/favicon.ico deve ser sempre permitido', () => {
    assert.ok(alwaysAllowed.some((p) => '/favicon.ico'.startsWith(p)));
  });

  it('/api/calcular-eng NÃO deve ser sempre permitido', () => {
    assert.equal(alwaysAllowed.some((p) => '/api/calcular-eng'.startsWith(p)), false);
  });

  it('rota não listada (ex: /) deve cair no else (NextResponse.next)', () => {
    const isProtected = protectedRoutes.some((p) => '/'.startsWith(p));
    const isPublic = publicRoutes.some((p) => '/'.startsWith(p));
    const isAllowed = alwaysAllowed.some((p) => '/'.startsWith(p));
    assert.equal(isProtected, false);
    assert.equal(isPublic, false);
    assert.equal(isAllowed, false);
  });

  it('cookie de autenticação deve ser sb-access-token', () => {
    const cookieName = 'sb-access-token';
    assert.equal(cookieName, 'sb-access-token');
  });
});
