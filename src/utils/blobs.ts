import { getStore } from '@netlify/blobs';
import type {
  DemoAreaStats,
  DemoContractorStats,
  DemoDamageReport,
  DemoProject,
  DemoRole,
  DemoUserRoleInfo,
} from '../demo/demo-types.js';

export type Channel = 'messenger' | 'web';

export interface UserProfileBlob {
  id: string;
  channel: Channel;
  channelUserId: string;
  name?: string;
  // Optional demo-only metadata for simulation mode.
  demoRole?: DemoRole;
  demoCanonicalName?: string;
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

export interface DemoSessionTokenBlob {
  token: string;
  userId: string;
  role: DemoRole;
  mode: 'demo';
  primaryReportId?: string;
  createdAt: string;
  expiresAt: string;
}

// Blob stores:
// - "users":              one JSON blob per user profile, keyed by `${channel}:${channelUserId}.json`
// - "messages":           one JSON array per user, keyed by `${userId}.json` (full message history)
// - "damage_reports":     one JSON blob per report, keyed by `${userId}/${reportId}.json`
// - "reportTokens":       one JSON blob per time-limited report token, keyed by `${reportId}/${token}.json`
// - \"demo_damage_reports\": demo-only damage reports for Hurricane Santa, keyed by `${reportId}.json`
// - \"demo_projects\":       demo-only contractor projects, keyed by `${projectId}.json`
// - \"demo_roles\":          demo user-role bindings, keyed by `${userId}.json`
// - \"demo_stats\":          aggregated demo stats (area + contractor), typically a single JSON blob
const usersStore = () => getStore({ name: 'users' });
const messagesStore = () => getStore({ name: 'messages' });
const reportsStore = () => getStore({ name: 'damage_reports' });
const reportTokensStore = () => getStore({ name: 'reportTokens' });

const demoReportsStore = () => getStore({ name: 'demo_damage_reports' });
const demoProjectsStore = () => getStore({ name: 'demo_projects' });
const demoRolesStore = () => getStore({ name: 'demo_roles' });
const demoStatsStore = () => getStore({ name: 'demo_stats' });
const demoSessionsStore = () => getStore({ name: 'demo_sessions' });

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

// === Demo-mode storage helpers ===

export async function saveDemoSessionToken(
  session: DemoSessionTokenBlob,
): Promise<DemoSessionTokenBlob> {
  const key = `${session.token}.json`;
  const store = demoSessionsStore();
  const timestamp = nowIso();
  const next: DemoSessionTokenBlob = {
    ...session,
    createdAt: timestamp,
  };
  await store.setJSON(key, next);
  return next;
}

export async function getDemoSessionToken(
  token: string,
): Promise<DemoSessionTokenBlob | null> {
  const key = `${token}.json`;
  const store = demoSessionsStore();
  const value = (await store.get(key, { type: 'json' })) as DemoSessionTokenBlob | null;
  return value ?? null;
}

export async function updateUserDemoInfoById(
  userId: string,
  info: { demoRole?: DemoRole; demoCanonicalName?: string },
): Promise<void> {
  const store = usersStore();
  const list = await store.list();
  for (const blob of list.blobs) {
    const key = blob.key;
    const user = (await store.get(key, { type: 'json' })) as UserProfileBlob | null;
    if (user?.id === userId) {
      const next: UserProfileBlob = {
        ...user,
        demoRole: info.demoRole ?? user.demoRole,
        demoCanonicalName: info.demoCanonicalName ?? user.demoCanonicalName,
        updatedAt: nowIso(),
      };
      await store.setJSON(key, next);
      break;
    }
  }
}

export async function getUserById(userId: string): Promise<UserProfileBlob | null> {
  const store = usersStore();
  const list = await store.list();
  for (const blob of list.blobs) {
    const key = blob.key;
    const user = (await store.get(key, { type: 'json' })) as UserProfileBlob | null;
    if (user?.id === userId) {
      return user;
    }
  }
  return null;
}

export async function saveDemoDamageReport(
  report: DemoDamageReport,
): Promise<DemoDamageReport> {
  const key = `${report.id}.json`;
  const store = demoReportsStore();
  const timestamp = nowIso();
  const existing = (await store.get(key, { type: 'json' })) as DemoDamageReport | null;
  const next: DemoDamageReport = {
    ...(existing ?? {
      ...report,
      createdAt: timestamp,
      isDemo: true as const,
    }),
    ...report,
    updatedAt: timestamp,
    isDemo: true as const,
  };
  await store.setJSON(key, next);
  return next;
}

export async function listAllDemoDamageReports(): Promise<DemoDamageReport[]> {
  const store = demoReportsStore();
  const list = await store.list();
  const reports: DemoDamageReport[] = [];
  for (const blob of list.blobs) {
    const report = (await store.get(blob.key, { type: 'json' })) as DemoDamageReport | null;
    if (report) reports.push(report);
  }
  return reports;
}

export async function saveDemoProject(project: DemoProject): Promise<DemoProject> {
  const key = `${project.id}.json`;
  const store = demoProjectsStore();
  const timestamp = nowIso();
  const existing = (await store.get(key, { type: 'json' })) as DemoProject | null;
  const next: DemoProject = {
    ...(existing ?? {
      ...project,
      createdAt: timestamp,
      isDemo: true as const,
    }),
    ...project,
    updatedAt: timestamp,
    isDemo: true as const,
  };
  await store.setJSON(key, next);
  return next;
}

export async function listAllDemoProjects(): Promise<DemoProject[]> {
  const store = demoProjectsStore();
  const list = await store.list();
  const projects: DemoProject[] = [];
  for (const blob of list.blobs) {
    const project = (await store.get(blob.key, { type: 'json' })) as DemoProject | null;
    if (project) projects.push(project);
  }
  return projects;
}

export async function getDemoRoleForUser(userId: string): Promise<DemoUserRoleInfo | null> {
  const key = `${userId}.json`;
  const store = demoRolesStore();
  const info = (await store.get(key, { type: 'json' })) as DemoUserRoleInfo | null;
  return info ?? null;
}

export async function saveDemoRoleForUser(
  userId: string,
  roleInfo: DemoUserRoleInfo,
): Promise<DemoUserRoleInfo> {
  const key = `${userId}.json`;
  const store = demoRolesStore();
  const next: DemoUserRoleInfo = { ...roleInfo, userId };
  await store.setJSON(key, next);
  return next;
}

export async function deleteDemoRoleForUser(userId: string): Promise<void> {
  const key = `${userId}.json`;
  const store = demoRolesStore();
  await store.delete(key);
}

export interface DemoStatsBlob {
  areaStats: DemoAreaStats[];
  contractorStats: DemoContractorStats[];
}

const DEMO_STATS_KEY = 'aggregate.json';

export async function saveDemoAreaStatsBatch(stats: DemoAreaStats[]): Promise<void> {
  const store = demoStatsStore();
  const existing = (await store.get(DEMO_STATS_KEY, {
    type: 'json',
  })) as DemoStatsBlob | null;
  const next: DemoStatsBlob = {
    areaStats: stats,
    contractorStats: existing?.contractorStats ?? [],
  };
  await store.setJSON(DEMO_STATS_KEY, next);
}

export async function saveDemoContractorStatsBatch(
  stats: DemoContractorStats[],
): Promise<void> {
  const store = demoStatsStore();
  const existing = (await store.get(DEMO_STATS_KEY, {
    type: 'json',
  })) as DemoStatsBlob | null;
  const next: DemoStatsBlob = {
    areaStats: existing?.areaStats ?? [],
    contractorStats: stats,
  };
  await store.setJSON(DEMO_STATS_KEY, next);
}

export async function getDemoStats(): Promise<DemoStatsBlob | null> {
  const store = demoStatsStore();
  const existing = (await store.get(DEMO_STATS_KEY, {
    type: 'json',
  })) as DemoStatsBlob | null;
  return existing ?? null;
}


