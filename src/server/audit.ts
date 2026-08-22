/**
 * Audit.
 *
 * Every mutation records what changed, who changed it and when. The record is
 * append-only: nothing updates or deletes an audit row, because a trail that
 * can be edited is not a trail.
 *
 * The actor travels in async context rather than as a parameter on every write
 * function. That is deliberate. Threading `actor` through a dozen signatures
 * invites the one call site that forgets, and a mutation with no actor is worse
 * than useless — it looks like an answer while telling you nothing.
 *
 * There is no authentication yet, so the actor is whatever the caller declares.
 * That is still worth recording: knowing a change came from the seeder rather
 * than the Dashboard is most of what an audit trail is for at this stage, and
 * the column is ready for a real identity the moment there is one.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface Actor {
  /** Who or what made the change. Free text until identities exist. */
  name: string;
  /** How the change arrived: dashboard, api, seed, import, test. */
  via: string;
}

const context = new AsyncLocalStorage<Actor>();

const SYSTEM: Actor = { name: "system", via: "unknown" };

/** Runs `fn` with every mutation inside it attributed to `actor`. */
export function asActor<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  return context.run(actor, fn);
}

export function currentActor(): Actor {
  return context.getStore() ?? SYSTEM;
}

/** How the actor is written to the log: "name (via)". */
export function actorLabel(actor: Actor = currentActor()): string {
  return `${actor.name} (${actor.via})`;
}

export type Query = <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>;

export interface AuditEntry {
  /** What happened, as a verb: product.created, variant.price_changed. */
  action: string;
  entityType: string;
  entityId?: string | null;
  /** State before the change, where there was one. */
  before?: unknown;
  /** State after the change, where there is one. */
  after?: unknown;
}

/**
 * Writes an audit row on the caller's connection.
 *
 * It takes a `Query` rather than using the pool so the audit lands in the same
 * transaction as the change it describes. A separate connection could commit
 * the audit for a change that then rolled back, which would be a record of
 * something that never happened.
 */
export async function record(q: Query, entry: AuditEntry): Promise<void> {
  await q(
    `INSERT INTO audit_log (actor, action, entity_type, entity_id, before, after)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      actorLabel(),
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
    ],
  );
}

/**
 * The fields that changed between two states.
 *
 * An audit row saying "the product was updated" is barely worth writing. This
 * narrows `before` and `after` to the keys that actually differ, so reading the
 * trail shows what moved rather than a wall of unchanged values.
 *
 * Returns null when nothing changed, which callers use to skip the row
 * entirely: an update that updated nothing is not an event.
 */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  let changed = false;

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    changedBefore[key] = before[key] ?? null;
    changedAfter[key] = after[key] ?? null;
    changed = true;
  }

  return changed ? { before: changedBefore, after: changedAfter } : null;
}
