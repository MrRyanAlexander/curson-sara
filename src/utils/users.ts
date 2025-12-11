import { Channel, UserProfileBlob, getUserByChannelId, upsertUser } from './blobs.js';

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

export function toLlmUserProfile(user: UserProfileBlob): UserProfileForLlm {
  return {
    id: user.id,
    name: user.name,
    channel: user.channel,
    reportIdsWithStatus: user.reportIdsWithStatus ?? [],
  };
}


