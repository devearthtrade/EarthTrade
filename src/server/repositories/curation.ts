/**
 * Curation gaps: curated product references that no longer resolve.
 *
 * Reads only. Settling one is a write, and lives in `writes.ts` with everything
 * else that changes the catalog.
 */

import { rows } from "../db/index.ts";

export interface CurationGap {
  id: string;
  sourceType: string;
  sourceHandle: string;
  missingHandle: string;
  position: number;
  resolution: string | null;
  mappedToHandle: string | null;
  note: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  firstSeenAt: Date;
}

interface Row {
  id: string;
  source_type: string;
  source_handle: string;
  missing_handle: string;
  position: number;
  resolution: string | null;
  mapped_handle: string | null;
  note: string | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  first_seen_at: Date;
}

const toGap = (r: Row): CurationGap => ({
  id: r.id,
  sourceType: r.source_type,
  sourceHandle: r.source_handle,
  missingHandle: r.missing_handle,
  position: r.position,
  resolution: r.resolution,
  mappedToHandle: r.mapped_handle,
  note: r.note,
  resolvedAt: r.resolved_at,
  resolvedBy: r.resolved_by,
  firstSeenAt: r.first_seen_at,
});

const SELECT = `
  SELECT g.id, g.source_type, g.source_handle, g.missing_handle, g.position,
         g.resolution, p.handle AS mapped_handle, g.note,
         g.resolved_at, g.resolved_by, g.first_seen_at
    FROM curation_gaps g
    LEFT JOIN products p ON p.id = g.mapped_to`;

export async function listGaps(
  filter: { open?: boolean; sourceHandle?: string } = {},
): Promise<CurationGap[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown): string => `$${params.push(v)}`;

  if (filter.open === true) where.push(`g.resolved_at IS NULL`);
  if (filter.open === false) where.push(`g.resolved_at IS NOT NULL`);
  if (filter.sourceHandle) where.push(`g.source_handle = ${bind(filter.sourceHandle)}`);

  const r = await rows<Row>(
    `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY g.source_handle, g.position, g.missing_handle`,
    params,
  );
  return r.map(toGap);
}

export async function getGap(id: string): Promise<CurationGap | null> {
  const r = await rows<Row>(`${SELECT} WHERE g.id = $1`, [id]);
  return r[0] ? toGap(r[0]) : null;
}

export async function gapSummary(): Promise<{ open: number; resolved: number; sources: number }> {
  const [row] = await rows<{ open: number; resolved: number; sources: number }>(
    `SELECT count(*) FILTER (WHERE resolved_at IS NULL)::int     AS open,
            count(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resolved,
            count(DISTINCT source_handle)
              FILTER (WHERE resolved_at IS NULL)::int            AS sources
       FROM curation_gaps`,
  );
  return row ?? { open: 0, resolved: 0, sources: 0 };
}

/**
 * Products whose handle resembles the missing one, as a starting point for a
 * person choosing a replacement.
 *
 * These are suggestions to look at, never a decision. Nothing in the system
 * acts on this list; it only shortens the search.
 */
export async function suggestionsFor(missingHandle: string, limit = 8): Promise<string[]> {
  // Longest shared prefix of hyphen-separated words, which is what a renamed
  // product usually keeps.
  const stem = missingHandle.split("-").slice(0, 2).join("-");
  const r = await rows<{ handle: string }>(
    `SELECT handle FROM products
      WHERE publishable AND (strpos(handle, $1) > 0 OR strpos($2, split_part(handle, '-', 1)) = 1)
      ORDER BY length(handle), handle
      LIMIT $3`,
    [stem, missingHandle, limit],
  );
  return r.map((x) => x.handle);
}
