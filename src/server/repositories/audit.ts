/** Reading the audit trail. */

import { rows } from "../db/index.ts";

export interface AuditRecord {
  id: number;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}

interface Row {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: Date;
}

const toRecord = (r: Row): AuditRecord => ({
  id: r.id,
  actor: r.actor,
  action: r.action,
  entityType: r.entity_type,
  entityId: r.entity_id,
  before: r.before,
  after: r.after,
  createdAt: r.created_at,
});

export interface AuditFilter {
  entityType?: string;
  entityId?: string;
  actor?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export async function listAudit(filter: AuditFilter = {}): Promise<AuditRecord[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown): string => `$${params.push(v)}`;

  if (filter.entityType) where.push(`entity_type = ${bind(filter.entityType)}`);
  if (filter.entityId) where.push(`entity_id = ${bind(filter.entityId)}::uuid`);
  if (filter.actor) where.push(`actor = ${bind(filter.actor)}`);
  if (filter.action) where.push(`action = ${bind(filter.action)}`);

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = bind(Math.min(filter.limit ?? 50, 500));
  const offset = bind(filter.offset ?? 0);

  const r = await rows<Row>(
    `SELECT id, actor, action, entity_type, entity_id, before, after, created_at
       FROM audit_log ${clause}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return r.map(toRecord);
}

export async function countAudit(filter: AuditFilter = {}): Promise<number> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown): string => `$${params.push(v)}`;

  if (filter.entityType) where.push(`entity_type = ${bind(filter.entityType)}`);
  if (filter.entityId) where.push(`entity_id = ${bind(filter.entityId)}::uuid`);
  if (filter.actor) where.push(`actor = ${bind(filter.actor)}`);
  if (filter.action) where.push(`action = ${bind(filter.action)}`);

  const [row] = await rows<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params,
  );
  return row?.n ?? 0;
}

/** The history of one product, by its internal id. */
export async function productHistory(handle: string, limit = 50): Promise<AuditRecord[]> {
  const r = await rows<Row>(
    `SELECT a.id, a.actor, a.action, a.entity_type, a.entity_id, a.before, a.after, a.created_at
       FROM audit_log a
       JOIN products p ON p.id = a.entity_id
      WHERE p.handle = $1
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $2`,
    [handle, limit],
  );
  return r.map(toRecord);
}

/** Distinct actors and actions, for filter menus. */
export async function auditFacets(): Promise<{ actors: string[]; actions: string[]; entityTypes: string[] }> {
  const [actors, actions, entityTypes] = await Promise.all([
    rows<{ v: string }>(`SELECT DISTINCT actor AS v FROM audit_log ORDER BY 1`),
    rows<{ v: string }>(`SELECT DISTINCT action AS v FROM audit_log ORDER BY 1`),
    rows<{ v: string }>(`SELECT DISTINCT entity_type AS v FROM audit_log ORDER BY 1`),
  ]);
  return {
    actors: actors.map((x) => x.v),
    actions: actions.map((x) => x.v),
    entityTypes: entityTypes.map((x) => x.v),
  };
}
