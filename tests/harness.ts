/**
 * A very small test harness.
 *
 * The project has no node_modules, so there is no test framework to reach for.
 * This is what the tests actually need: grouping, assertions with useful
 * failure messages, and a non-zero exit when something fails.
 *
 * Tests run against the real local database, not a mock. A mock of a database
 * agrees with whatever you assumed when you wrote it, which is exactly the
 * assumption a test is supposed to check. Every test that writes cleans up
 * after itself, and the suite asserts at the end that the 110 imported products
 * are untouched.
 */

export interface TestResult {
  passed: number;
  failed: { suite: string; test: string; error: string }[];
}

const result: TestResult = { passed: 0, failed: [] };

let currentSuite = "";
const pending: { suite: string; name: string; fn: () => Promise<void> | void }[] = [];

export function suite(name: string, body: () => void): void {
  currentSuite = name;
  body();
  currentSuite = "";
}

export function test(name: string, fn: () => Promise<void> | void): void {
  pending.push({ suite: currentSuite, name, fn });
}

/* ------------------------------- assertions ------------------------------ */

export class AssertionError extends Error {}

function show(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  return JSON.stringify(v) ?? String(v);
}

export function ok(value: unknown, message = "expected a truthy value"): void {
  if (!value) throw new AssertionError(`${message} (got ${show(value)})`);
}

export function equal(actual: unknown, expected: unknown, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new AssertionError(message ?? `expected ${show(expected)}, got ${show(actual)}`);
  }
}

export function deepEqual(actual: unknown, expected: unknown, message?: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new AssertionError(message ?? `expected ${b}\n           got      ${a}`);
}

export function includes(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new AssertionError(message ?? `expected ${show(haystack)} to contain ${show(needle)}`);
  }
}

/** Asserts the call throws, and returns the error so its message can be checked. */
export async function rejects(fn: () => Promise<unknown>, contains?: string): Promise<Error> {
  try {
    await fn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (contains && !error.message.includes(contains)) {
      throw new AssertionError(
        `expected the failure to mention ${show(contains)}, got ${show(error.message)}`,
      );
    }
    return error;
  }
  throw new AssertionError(`expected this to fail${contains ? ` with ${show(contains)}` : ""}, but it succeeded`);
}

/* --------------------------------- runner -------------------------------- */

/**
 * Runs the queued tests, optionally only those in suites matching `only`.
 *
 * The filter exists because some checks are only meaningful once everything
 * else has finished and cleaned up — asserting the imported catalog is
 * untouched is not a claim you can make while test products are still in the
 * table.
 */
export async function run(label: string, only?: (suite: string) => boolean): Promise<TestResult> {
  console.log(`\n${label}\n${"─".repeat(label.length)}\n`);

  const queued = pending.filter((t) => !only || only(t.suite));
  for (const t of queued) pending.splice(pending.indexOf(t), 1);

  let shown = "";
  for (const t of queued) {
    if (t.suite !== shown) {
      console.log(`${t.suite}`);
      shown = t.suite;
    }
    try {
      await t.fn();
      result.passed++;
      console.log(`  ok    ${t.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ suite: t.suite, test: t.name, error: message });
      console.log(`  FAIL  ${t.name}`);
      console.log(`        ${message.split("\n").join("\n        ")}`);
    }
  }

  console.log(
    `\n${result.passed} passed, ${result.failed.length} failed, ${result.passed + result.failed.length} total`,
  );
  return result;
}
