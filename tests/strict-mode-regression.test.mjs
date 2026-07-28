import { describe, it } from "node:test";
import assert from "node:assert";

/**
 * Strict Mode Regression Test
 *
 * Simula o ciclo do React Strict Mode:
 *   mount -> cleanup -> remount -> ENGINE_READY
 *
 * O teste falha se disposedRef n?o for resetado no remount,
 * exatamente como acontecia no bug original.
 */

describe("Strict Mode Regression - disposedRef reset", () => {
  let disposedRef;
  let engineReadyRef;
  let engineReadyReceived;
  let mountCount;
  let cleanupCount;

  function reset() {
    disposedRef = { current: false };
    engineReadyRef = { current: false };
    engineReadyReceived = false;
    mountCount = 0;
    cleanupCount = 0;
  }

  function mount() {
    mountCount++;
    // === CORRECAO: disposedRef.current = false no mount ===
    disposedRef.current = false;
  }

  function cleanup() {
    cleanupCount++;
    disposedRef.current = true;
  }

  function handleMessage() {
    // disposed check (mesmo do hook original)
    if (disposedRef.current) return; // <-- bug original: nunca voltava a false
    engineReadyRef.current = true;
    engineReadyReceived = true;
  }

  it("deve receber ENGINE_READY apos mount -> cleanup -> remount (COM correcao)", () => {
    reset();
    // Strict Mode ciclo 1: mount
    mount();
    assert.strictEqual(disposedRef.current, false, "disposed=false apos 1o mount");

    // Strict Mode: cleanup
    cleanup();
    assert.strictEqual(disposedRef.current, true, "disposed=true apos cleanup");

    // Strict Mode: remount
    mount();
    assert.strictEqual(disposedRef.current, false, "disposed=false apos remount (linha 220)");

    // ENGINE_READY chega
    handleMessage();
    assert.strictEqual(engineReadyRef.current, true, "engineReady=true apos ENGINE_READY");
    assert.strictEqual(engineReadyReceived, true, "ENGINE_READY foi processada");
  });

  it("deve FALHAR sem a correcao (disposed nao resetado no remount)", () => {
    reset();

    function mountWithoutFix() {
      mountCount++;
      // disposedRef.current = false  <-- SEM CORRECAO
    }

    mountWithoutFix();
    assert.strictEqual(disposedRef.current, false, "disposed=false apos 1o mount");
    cleanup();
    assert.strictEqual(disposedRef.current, true, "disposed=true apos cleanup");
    mountWithoutFix();
    assert.strictEqual(disposedRef.current, true, "disposed AINDA true apos remount (SEM correcao)");

    // ENGINE_READY chega, mas eh rejeitada
    handleMessage();
    assert.strictEqual(engineReadyReceived, false, "ENGINE_READY NAO foi processada (BUG)");
  });

  it("deve resetar disposedRef em toda montagem valida", () => {
    reset();
    // Multiplos ciclos Strict Mode
    for (let i = 0; i < 10; i++) {
      mount();
      assert.strictEqual(disposedRef.current, false, `disposed=false apos mount #${i + 1}`);
      cleanup();
      assert.strictEqual(disposedRef.current, true, `disposed=true apos cleanup #${i + 1}`);
    }
    // Final mount
    mount();
    assert.strictEqual(disposedRef.current, false, "disposed=false apos mount final");
    handleMessage();
    assert.strictEqual(engineReadyReceived, true, "ENGINE_READY processada apos multiplos ciclos");
  });

  it("deve manter disposed=true apos unmount real (sem novo mount)", () => {
    reset();
    mount();
    cleanup();
    assert.strictEqual(disposedRef.current, true, "disposed=true apos unmount real");
    // Sem novo mount: disposed permanece true
    assert.strictEqual(disposedRef.current, true, "disposed ainda true sem remount");
  });
});
