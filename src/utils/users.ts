import {
  type Channel,
  type DamageReportBlob,
  type UserProfileBlob,
  getUserByChannelId,
  upsertUser,
} from './blobs.js';

export interface UserProfileForLlm {
  id: string;
  name?: string;
  channel: Channel;
  reportIdsWithStatus: Array<{ id: string; status: string; address?: string }>;
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
  };
}


