/**
 * Platform config — reads admin-managed Global Config values (service radius,
 * minimum order) from the API's public endpoint (GET /config/public), with a
 * short cache + safe defaults. Set in admin → Intelligence & Control → Config.
 *
 * 2026-06-14: created to consume the platform_settings the admin Global Config
 * panel writes. Falls back to sane defaults if the API is unreachable.
 */

import { getApiUrl } from './api';

export interface PlatformConfig {
  serviceRadiusKm: number;
  minOrderValue: number;
}

const DEFAULTS: PlatformConfig = { serviceRadiusKm: 10, minOrderValue: 0 };
const TTL_MS = 5 * 60 * 1000;

let cache: PlatformConfig | null = null;
let cacheAt = 0;

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;
  try {
    const res = await fetch(`${getApiUrl()}/config/public`);
    if (!res.ok) throw new Error(`config ${res.status}`);
    const data = await res.json();
    cache = {
      serviceRadiusKm: Number(data?.serviceRadiusKm) > 0 ? Number(data.serviceRadiusKm) : DEFAULTS.serviceRadiusKm,
      minOrderValue: Number.isFinite(Number(data?.minOrderValue)) && Number(data.minOrderValue) >= 0 ? Number(data.minOrderValue) : DEFAULTS.minOrderValue,
    };
    cacheAt = now;
    return cache;
  } catch {
    return cache ?? DEFAULTS;
  }
}
