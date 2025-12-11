export type SaraMode = 'demo' | 'live';

// Determine Sara's operating mode from the environment.
// Defaults to "demo" to ensure we never accidentally treat demo data as live.
const rawMode = (process.env.SARA_MODE ?? 'demo').toLowerCase();

export const SARA_MODE: SaraMode = rawMode === 'live' ? 'live' : 'demo';

export const IS_DEMO: boolean = SARA_MODE === 'demo';

// Base site URL used when generating public/demo links.
// Falls back to an empty string if not configured; callers should handle that case.
export const SITE_URL: string = process.env.SITE_URL ?? '';
