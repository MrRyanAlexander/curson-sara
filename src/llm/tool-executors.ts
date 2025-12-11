import crypto from 'node:crypto';
import {
  type DamageReportBlob,
  deleteReport,
  getReportById,
  getReportToken,
  getUserReports,
  saveReport,
  saveReportToken,
} from '../utils/blobs.js';

export interface ToolExecutionContext {
  userId: string;
  siteUrl?: string;
}

export async function executeToolCall(
  toolName: string,
  args: any,
  context: ToolExecutionContext,
): Promise<unknown> {
  switch (toolName) {
    case 'start_damage_report':
      return startDamageReport(args, context);
    case 'update_damage_report_section':
      return updateDamageReportSection(args, context);
    case 'get_report_details':
      return getReportDetails(args, context);
    case 'list_user_reports':
      return listUserReports(context);
    case 'update_report_address':
      return updateReportAddress(args, context);
    case 'update_report_photos':
      return updateReportPhotos(args, context);
    case 'delete_report':
      return deleteReportTool(args, context);
    case 'mark_report_resolved':
      return markReportResolved(args, context);
    case 'create_time_limited_report_link':
      return createTimeLimitedReportLink(args, context);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function startDamageReport(
  args: { address: string },
  context: ToolExecutionContext,
): Promise<DamageReportBlob> {
  const id = crypto.randomUUID();
  const report: DamageReportBlob = {
    id,
    userId: context.userId,
    address: args.address,
    status: 'pending',
    photoUrls: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return saveReport(report);
}

async function updateDamageReportSection(
  args: { reportId: string; address?: string; status?: DamageReportBlob['status']; photoUrls?: string[] },
  context: ToolExecutionContext,
): Promise<DamageReportBlob> {
  const existing = await ensureUserOwnsReport(context.userId, args.reportId);
  const next: DamageReportBlob = {
    ...existing,
    address: args.address ?? existing.address,
    status: args.status ?? existing.status,
    photoUrls: args.photoUrls ?? existing.photoUrls,
    updatedAt: new Date().toISOString(),
  };
  return saveReport(next);
}

async function getReportDetails(
  args: { reportId: string },
  context: ToolExecutionContext,
): Promise<DamageReportBlob | null> {
  return ensureUserOwnsReport(context.userId, args.reportId);
}

async function listUserReports(context: ToolExecutionContext): Promise<
  Array<{ id: string; status: string; address?: string }>
> {
  const reports = await getUserReports(context.userId);
  return reports.map((r) => ({ id: r.id, status: r.status, address: r.address }));
}

async function updateReportAddress(
  args: { reportId: string; address: string },
  context: ToolExecutionContext,
): Promise<DamageReportBlob> {
  const existing = await ensureUserOwnsReport(context.userId, args.reportId);
  const next: DamageReportBlob = {
    ...existing,
    address: args.address,
    updatedAt: new Date().toISOString(),
  };
  return saveReport(next);
}

async function updateReportPhotos(
  args: { reportId: string; photoUrls: string[] },
  context: ToolExecutionContext,
): Promise<DamageReportBlob> {
  const existing = await ensureUserOwnsReport(context.userId, args.reportId);
  const next: DamageReportBlob = {
    ...existing,
    photoUrls: args.photoUrls,
    updatedAt: new Date().toISOString(),
  };
  return saveReport(next);
}

async function deleteReportTool(
  args: { reportId: string },
  context: ToolExecutionContext,
): Promise<{ deleted: boolean }> {
  const existing = await ensureUserOwnsReport(context.userId, args.reportId);
  if (existing.status !== 'pending') {
    throw new Error('Only pending reports can be deleted');
  }
  await deleteReport(context.userId, args.reportId);
  return { deleted: true };
}

async function markReportResolved(
  args: { reportId: string },
  context: ToolExecutionContext,
): Promise<DamageReportBlob> {
  const existing = await ensureUserOwnsReport(context.userId, args.reportId);
  const next: DamageReportBlob = {
    ...existing,
    status: 'resolved',
    updatedAt: new Date().toISOString(),
  };
  return saveReport(next);
}

async function createTimeLimitedReportLink(
  args: { reportId: string; ttlHours?: number },
  context: ToolExecutionContext,
): Promise<{ url: string; token: string; expiresAt: string }> {
  const report = await ensureUserOwnsReport(context.userId, args.reportId);
  const ttlHours = args.ttlHours ?? 24;
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

  await saveReportToken({
    reportId: report.id,
    token,
    expiresAt,
    createdAt: now.toISOString(),
  });

  const siteUrl = context.siteUrl ?? process.env.SITE_URL ?? '';
  const url = `${siteUrl.replace(/\/$/, '')}/report/${encodeURIComponent(
    report.id,
  )}?token=${encodeURIComponent(token)}`;

  return { url, token, expiresAt };
}

async function ensureUserOwnsReport(userId: string, reportId: string): Promise<DamageReportBlob> {
  const report = await getReportById(userId, reportId);
  if (!report) {
    throw new Error('Report not found for this user');
  }
  return report;
}


