import { AsyncLocalStorage } from "async_hooks";

export const regions = ["luzon", "visayas", "mindanao"] as const;

export type Region = (typeof regions)[number];

const regionByHost: Record<string, Region> = {
  "mietubl-luzon.com": "luzon",
  "www.mietubl-luzon.com": "luzon",
  "mietubl-visayas.com": "visayas",
  "www.mietubl-visayas.com": "visayas",
  "mietubl-mindanao.com": "mindanao",
  "www.mietubl-mindanao.com": "mindanao",
};

const requestRegion = new AsyncLocalStorage<Region>();

function isRegion(value: string | undefined): value is Region {
  return value !== undefined && regions.some((region) => region === value);
}

export function resolveRegion(host: string): Region | undefined {
  const hostname = host.trim().toLowerCase().replace(/\.$/, "").split(":")[0];
  return regionByHost[hostname];
}

export function runWithRegion<T>(region: Region, callback: () => T): T {
  return requestRegion.run(region, callback);
}

export function getConfiguredRegion(): Region | undefined {
  const region = process.env.DB_REGION?.toLowerCase();
  return isRegion(region) ? region : undefined;
}

export function getCurrentRegion(): Region {
  const region = requestRegion.getStore() ?? getConfiguredRegion();
  if (isRegion(region)) return region;

  throw new Error("No database region selected for this request");
}
