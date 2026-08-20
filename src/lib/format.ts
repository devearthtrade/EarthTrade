/** Formatting helpers shared across the build. */

export function money(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}

/** Price display for a product: single price or "From $x" when variants differ. */
export function priceRange(prices: number[]): string {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? money(min) : `From ${money(min)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isoDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toISOString();
}

export function displayDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
