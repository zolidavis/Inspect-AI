import { Hono } from "hono";
import { AddressSchema, PropertyLookupSchema, type PropertyLookup } from "@inspect-ai/shared";

export const address = new Hono();

/**
 * POST /address/lookup
 * body: Address
 * returns: PropertyLookup
 *
 * Uses RentCast's Property Records endpoint. If RENTCAST_API_KEY is unset,
 * returns a mocked payload so the app remains usable in dev.
 *
 * Permits are stubbed for v1 — wire county scrapers in a follow-up.
 */
address.post("/lookup", async (c) => {
  const parsed = AddressSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const addr = parsed.data;

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    const mock: PropertyLookup = {
      address: addr,
      ownerName: "MOCK OWNER (set RENTCAST_API_KEY)",
      yearBuilt: 1985,
      squareFootage: 1850,
      lotSize: 0.22,
      bedrooms: 3,
      bathrooms: 2,
      parcelId: null,
      permits: [],
      source: "mock",
    };
    return c.json(mock);
  }

  const params = new URLSearchParams({
    address: `${addr.line1}, ${addr.city}, ${addr.state} ${addr.zip}`,
  });
  const res = await fetch(`https://api.rentcast.io/v1/properties?${params}`, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    return c.json({ error: "rentcast_failed", status: res.status }, 502);
  }
  const data = (await res.json()) as any[];
  const first = data?.[0] ?? {};
  const out: PropertyLookup = {
    address: addr,
    ownerName: first?.owner?.names?.[0] ?? null,
    yearBuilt: first?.yearBuilt ?? null,
    squareFootage: first?.squareFootage ?? null,
    lotSize: first?.lotSize ?? null,
    bedrooms: first?.bedrooms ?? null,
    bathrooms: first?.bathrooms ?? null,
    parcelId: first?.assessorID ?? null,
    county: first?.county ?? null,
    permits: [], // TODO: county scrapers
    source: "rentcast",
  };
  return c.json(PropertyLookupSchema.parse(out));
});
