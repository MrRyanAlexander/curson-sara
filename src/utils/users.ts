import {
  type Channel,
  type DamageReportBlob,
  type UserProfileBlob,
  getUserByChannelId,
  upsertUser,
} from './blobs.js';
import type { DemoRole, DemoUserRoleInfo } from '../demo/demo-types.js';
import { SARA_MODE } from '../config.js';

export interface UserProfileForLlm {
  id: string;
  name?: string;
  channel: Channel;
  reportIdsWithStatus: Array<{ id: string; status: string; address?: string }>;
  // Demo-only context to help the LLM stay in persona.
  mode: 'demo' | 'live';
  demoRole?: DemoRole;
  demoCanonicalName?: string;
  primaryDemoReportId?: string;
}

export async function getOrCreateUser(
  channel: Channel,
  channelUserId: string,
  name?: string,
): Promise<UserProfileBlob> {
  const existing = await getUserByChannelId(channel, channelUserId);
  if (existing) return existing;
  return upsertUser(channel, channelUserId, { name });
}

export function toLlmUserProfile(
  user: UserProfileBlob,
  reports: DamageReportBlob[],
  demoRoleInfo?: DemoUserRoleInfo | null,
): UserProfileForLlm {
  return {
    id: user.id,
    name: user.name,
    channel: user.channel,
    // Derive report summary fresh on every turn from the reports blobs,
    // so the LLM always sees the latest IDs, statuses, and addresses.
    reportIdsWithStatus: reports.map((r) => ({
      id: r.id,
      status: r.status,
      address: r.address,
    })),
    mode: SARA_MODE === 'demo' ? 'demo' : 'live',
    demoRole: demoRoleInfo?.role ?? user.demoRole,
    demoCanonicalName: demoRoleInfo?.canonicalName ?? user.demoCanonicalName,
    primaryDemoReportId: demoRoleInfo?.primaryDemoReportId,
  };
}


