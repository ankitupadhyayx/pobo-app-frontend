/* Shared helpers for the live-backend integration script (Node, no React Native). */
export const GREEN = '\x1b[32m';
export const RED = '\x1b[31m';
export const DIM = '\x1b[2m';
export const RESET = '\x1b[0m';

export const results: { name: string; ok: boolean; note?: string }[] = [];

export async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const started = Date.now();
  try {
    const out = await fn();
    results.push({ name, ok: true });
    console.log(`${GREEN}✔${RESET} ${name} ${DIM}(${Date.now() - started}ms)${RESET}`);
    return out;
  } catch (e) {
    const note = e instanceof Error ? e.message : String(e);
    results.push({ name, ok: false, note });
    console.log(`${RED}✘ ${name}${RESET}\n   ${note}`);
    return undefined;
  }
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

export function summary(): number {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  for (const f of failed) console.log(`${RED}  - ${f.name}: ${f.note}${RESET}`);
  return failed.length ? 1 : 0;
}
