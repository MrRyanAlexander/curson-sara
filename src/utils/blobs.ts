import { getStore } from '@netlify/blobs';

export type Channel = 'messenger' | 'web';

export interface UserProfileBlob {
  id: string;
  channel: Channel;
  channelUserId: string;
  name?: string;
  reportIdsWithStatus?: Array<{ id: string; status: string; address?: string }>;
  createdAt: string;
  updatedAt: string;
}

export type MessageDirection = 'user' | 'assistant';

export interface MessageBlob {
  id: string;
  userId: string;
  direction: MessageDirection;
  // `contents.text` is the user or assistant text.
  // `contents.mediaUrls` (optional) holds any image URLs attached to that message
  // (for example, Messenger image attachments). This is included in the LLM
  // context so Sara can use attached photos when calling tools.
  contents: { text: string; mediaUrls?: string[] };
  createdAt: string;
}

export interface DamageReportBlob {
  id: string;
  userId: string;
  address?: string;
  status: 'pending' | 'completed' | 'resolved';
  photoUrls: string[];
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTokenBlob {
  reportId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// Blob stores:
// - "users":          one JSON blob per user profile, keyed by `${channel}:${channelUserId}.json`
// - "messages":       one JSON array per user, keyed by `${userId}.json` (full message history)
// - "damage_reports": one JSON blob per report, keyed by `${userId}/${reportId}.json`
// - "reportTokens":   one JSON blob per time-limited report token, keyed by `${reportId}/${token}.json`
const usersStore = () => getStore({ name: 'users' });
const messagesStore = () => getStore({ name: 'messages' });
const reportsStore = () => getStore({ name: 'damage_reports' });
const reportTokensStore = () => getStore({ name: 'reportTokens' });

const nowIso = () => new Date().toISOString();

export async function getUserByChannelId(
  channel: Channel,
  channelUserId: string,
): Promise<UserProfileBlob | null> {
  const key = `${channel}:${channelUserId}.json`;
  const store = usersStore();
  const user = (await store.get(key, { type: 'json' })) as UserProfileBlob | null;
  return user ?? null;
}

export async function upsertUser(
  channel: Channel,
  channelUserId: string,
  partial: Partial<UserProfileBlob>,
): Promise<UserProfileBlob> {
  const key = `${channel}:${channelUserId}.json`;
  const store = usersStore();
  const existing = (await store.get(key, { type: 'json' })) as UserProfileBlob | null;
  const timestamp = nowIso();
  const next: UserProfileBlob = {
    id: existing?.id ?? `${channel}-${channelUserId}`,
    channel,
    channelUserId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    reportIdsWithStatus: existing?.reportIdsWithStatus ?? [],
    ...existing,
    ...partial,
  };
  await store.setJSON(key, next);
  return next;
}

export async function getMessagesForUser(userId: string): Promise<MessageBlob[]> {
  const key = `${userId}.json`;
  const store = messagesStore();
  const messages = ((await store.get(key, { type: 'json' })) as MessageBlob[] | null) ?? [];
  return messages;
}

export async function appendMessagesForUser(
  userId: string,
  newMessages: MessageBlob[],
): Promise<void> {
  const key = `${userId}.json`;
  const store = messagesStore();
  const existing = ((await store.get(key, { type: 'json' })) as MessageBlob[] | null) ?? [];
  const next = [...existing, ...newMessages];
  await store.setJSON(key, next);
}

export async function getUserReports(userId: string): Promise<DamageReportBlob[]> {
  const store = reportsStore();
  const list = await store.list({ prefix: `${userId}/` });
  const reports: DamageReportBlob[] = [];
  for (const key of list.blobs.map((b) => b.key)) {
    const report = (await store.get(key, { type: 'json' })) as DamageReportBlob | null;
    if (report) reports.push(report);
  }
  return reports;
}

export async function getReportById(
  userId: string,
  reportId: string,
): Promise<DamageReportBlob | null> {
  const key = `${userId}/${reportId}.json`;
  const store = reportsStore();
  const report = (await store.get(key, { type: 'json' })) as DamageReportBlob | null;
  return report ?? null;
}

export async function saveReport(report: DamageReportBlob): Promise<DamageReportBlob> {
  const key = `${report.userId}/${report.id}.json`;
  const store = reportsStore();
  const timestamp = nowIso();
  const existing = (await store.get(key, { type: 'json' })) as DamageReportBlob | null;
  const next: DamageReportBlob = {
    ...(existing ?? {
      id: report.id,
      userId: report.userId,
      status: 'pending',
      photoUrls: [],
      createdAt: timestamp,
    }),
    ...report,
    updatedAt: timestamp,
  };
  await store.setJSON(key, next);
  return next;
}

export async function deleteReport(userId: string, reportId: string): Promise<void> {
  const key = `${userId}/${reportId}.json`;
  const store = reportsStore();
  await store.delete(key);
}

export async function saveReportToken(token: ReportTokenBlob): Promise<ReportTokenBlob> {
  const key = `${token.reportId}/${token.token}.json`;
  const store = reportTokensStore();
  const timestamp = nowIso();
  const next: ReportTokenBlob = {
    ...token,
    createdAt: timestamp,
  };
  await store.setJSON(key, next);
  return next;
}

export async function getReportToken(
  reportId: string,
  token: string,
): Promise<ReportTokenBlob | null> {
  const key = `${reportId}/${token}.json`;
  const store = reportTokensStore();
  const value = (await store.get(key, { type: 'json' })) as ReportTokenBlob | null;
  return value ?? null;
}


