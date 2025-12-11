import crypto from 'node:crypto';
import {
  type DamageReportBlob,
  deleteReport,
  getReportById,
  getReportToken,
  getUserReports,
  getDemoSessionToken,
  saveDemoSessionToken,
  listAllDemoDamageReports,
  listAllDemoProjects,
  saveDemoDamageReport,
  saveDemoProject,
  saveReport,
  saveReportToken,
} from '../utils/blobs.js';
import { SITE_URL } from '../config.js';
import type { DemoRole } from '../demo/demo-types.js';
import {
  getOrCreateDemoRoleInfo,
  getDefaultReportIdForRole,
  setDemoRole,
} from '../demo/demo-roles.js';

export interface ToolExecutionContext {
  userId: string;
  siteUrl?: string;
  mode: 'demo' | 'live';
  role?: DemoRole;
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
    case 'set_demo_role':
      return setDemoRoleTool(args, context);
    case 'get_demo_overview_for_current_role':
      return getDemoOverviewForCurrentRole(context);
    case 'get_demo_report_for_current_role':
      return getDemoReportForCurrentRole(context);
    case 'update_demo_report_fields':
      return updateDemoReportFields(args, context);
    case 'update_demo_project_status':
      return updateDemoProjectStatus(args, context);
    case 'list_demo_reports_for_city':
      return listDemoReportsForCity(args, context);
    case 'get_demo_map_summary':
      return getDemoMapSummary(args, context);
    case 'get_demo_stats_for_contractor':
      return getDemoStatsForContractor(args, context);
    case 'create_demo_map_session_link':
      return createDemoMapSessionLink(args, context);
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

  const baseUrl = (context.siteUrl ?? SITE_URL).replace(/\/$/, '');
  const path =
    context.mode === 'demo'
      ? `/demo-report/${encodeURIComponent(report.id)}`
      : `/report/${encodeURIComponent(report.id)}`;
  const url = `${baseUrl}${path}?token=${encodeURIComponent(token)}`;

  return { url, token, expiresAt };
}

async function setDemoRoleTool(
  args: { role: DemoRole },
  context: ToolExecutionContext,
): Promise<unknown> {
  if (context.mode !== 'demo') {
    throw new Error('set_demo_role is only available in demo mode');
  }
  return setDemoRole(context.userId, args.role);
}

async function getDemoOverviewForCurrentRole(
  context: ToolExecutionContext,
): Promise<{
  role: DemoRole | null;
  canonicalName?: string;
  primaryDemoReportId?: string;
  summary: string;
}> {
  if (context.mode !== 'demo') {
    return {
      role: null,
      summary: 'Not in demo mode.',
    };
  }

  const roleInfo = await getOrCreateDemoRoleInfo(context.userId);
  if (!roleInfo) {
    return {
      role: null,
      summary:
        'The user has not selected a demo role yet. Invite them to choose resident, city worker, or contractor.',
    };
  }

  let summary: string;
  switch (roleInfo.role) {
    case 'resident':
      summary =
        'You are John Doe, a Saraville resident whose home was damaged by Hurricane Santa. Your roof and parts of the interior were impacted, and you are working with Sara to confirm your location, document damage, and understand next steps.';
      break;
    case 'city':
      summary =
        'You are Jane Smith from Saraville Emergency Management. You are using Sara to understand citywide damage after Hurricane Santa, prioritize unassigned reports, and coordinate response work across neighborhoods.';
      break;
    case 'contractor':
      summary =
        'You are John Smith, a local contractor in Saraville. You are using Sara to see your assigned jobs, update progress on bids and repairs, and understand how much work you have in the pipeline after Hurricane Santa.';
      break;
  }

  return {
    role: roleInfo.role,
    canonicalName: roleInfo.canonicalName,
    primaryDemoReportId: roleInfo.primaryDemoReportId,
    summary,
  };
}

async function getDemoReportForCurrentRole(
  context: ToolExecutionContext,
): Promise<unknown> {
  if (context.mode !== 'demo') {
    throw new Error('get_demo_report_for_current_role is only available in demo mode');
  }
  const roleInfo = await getOrCreateDemoRoleInfo(context.userId);
  if (!roleInfo) {
    throw new Error('No demo role found for this user');
  }

  const reports = await listAllDemoDamageReports();
  const primaryId = roleInfo.primaryDemoReportId ?? getDefaultReportIdForRole(roleInfo.role, context.userId);
  const report = reports.find((r) => r.id === primaryId) ?? reports[0] ?? null;

  const projects = await listAllDemoProjects();
  const linkedProject = report
    ? projects.find((p) => p.reportId === report.id) ?? null
    : null;

  return {
    role: roleInfo.role,
    report,
    project: linkedProject,
  };
}

async function updateDemoReportFields(
  args: {
    reportId: string;
    address?: string;
    damageType?: string;
    insuranceInfo?: string;
    helpRequested?: string;
    notes?: string;
  },
  context: ToolExecutionContext,
): Promise<unknown> {
  if (context.mode !== 'demo') {
    throw new Error('update_demo_report_fields is only available in demo mode');
  }

  const reports = await listAllDemoDamageReports();
  const existing = reports.find((r) => r.id === args.reportId);
  if (!existing) {
    throw new Error('Demo report not found');
  }

  const next = {
    ...existing,
    address: args.address ?? existing.address,
    damageType: args.damageType ?? existing.damageType,
    insuranceInfo: args.insuranceInfo ?? existing.insuranceInfo,
    helpRequested: args.helpRequested ?? existing.helpRequested,
  };

  return saveDemoDamageReport(next);
}

async function updateDemoProjectStatus(
  args: { projectId: string; status: 'bid' | 'in_progress' | 'completed'; note?: string },
  context: ToolExecutionContext,
): Promise<unknown> {
  if (context.mode !== 'demo') {
    throw new Error('update_demo_project_status is only available in demo mode');
  }

  const projects = await listAllDemoProjects();
  const existing = projects.find((p) => p.id === args.projectId);
  if (!existing) {
    throw new Error('Demo project not found');
  }

  const next = {
    ...existing,
    status: args.status,
    notes: args.note ?? existing.notes,
  };

  return saveDemoProject(next);
}

async function listDemoReportsForCity(
  args: { status: 'unassigned' | 'assigned' | 'completed' | 'any'; areaQuery?: string },
  context: ToolExecutionContext,
): Promise<unknown> {
  if (context.mode !== 'demo') {
    throw new Error('list_demo_reports_for_city is only available in demo mode');
  }
  if (context.role !== 'city') {
    throw new Error('Only the city demo role can list all demo reports');
  }

  const reports = await listAllDemoDamageReports();
  const filtered = reports.filter((r) => {
    if (args.status === 'any') return true;
    if (args.status === 'unassigned') return !r.assignedContractorId;
    if (args.status === 'assigned') return !!r.assignedContractorId && r.status !== 'completed';
    if (args.status === 'completed') return r.status === 'completed' || r.status === 'resolved';
    return true;
  });

  return {
    statusFilter: args.status,
    areaQuery: args.areaQuery,
    total: filtered.length,
    reports: filtered,
  };
}

async function getDemoMapSummary(
  args: {
    viewport: { centerLat: number; centerLng: number; radiusKm: number };
    areaId?: string;
  },
  context: ToolExecutionContext,
): Promise<unknown> {
  if (context.mode !== 'demo') {
    throw new Error('get_demo_map_summary is only available in demo mode');
  }

  const reports = await listAllDemoDamageReports();
  const projects = await listAllDemoProjects();

  if (context.role === 'resident') {
    const totalReports = reports.length;
    const assignedCount = reports.filter((r) => !!r.assignedContractorId).length;
    const completedCount = reports.filter(
      (r) => r.status === 'completed' || r.status === 'resolved',
    ).length;
    const inProgressCount = reports.filter((r) => r.status === 'in_progress').length;

    // Aggregate contractor popularity by number of jobs.
    const contractorJobCounts: Record<string, number> = {};
    for (const p of projects) {
      contractorJobCounts[p.contractorId] = (contractorJobCounts[p.contractorId] ?? 0) + 1;
    }

    const contractorStatsArray = Object.entries(contractorJobCounts).map(
      ([contractorId, jobCount]) => ({
        contractorId,
        jobCount,
      }),
    );

    contractorStatsArray.sort((a, b) => b.jobCount - a.jobCount);

    return {
      role: 'resident',
      viewport: args.viewport,
      areaId: args.areaId,
      totals: {
        totalReports,
        assignedCount,
        inProgressCount,
        completedCount,
      },
      topContractorsByJobCount: contractorStatsArray.slice(0, 5),
    };
  }

  if (context.role === 'city') {
    return {
      role: 'city',
      viewport: args.viewport,
      areaId: args.areaId,
      reports,
    };
  }

  if (context.role === 'contractor') {
    const roleInfo = await getOrCreateDemoRoleInfo(context.userId);
    const contractorId = roleInfo?.role === 'contractor' ? 'contractor-john-smith' : null;
    const assignedProjects = projects.filter((p) => p.contractorId === contractorId);
    const assignedReports = reports.filter((r) =>
      assignedProjects.some((p) => p.reportId === r.id),
    );

    return {
      role: 'contractor',
      viewport: args.viewport,
      areaId: args.areaId,
      projects: assignedProjects,
      reports: assignedReports,
    };
  }

  return {
    role: null,
    viewport: args.viewport,
    areaId: args.areaId,
    message: 'No demo role set; map summary is not scoped.',
  };
}

async function getDemoStatsForContractor(
  args: { lookbackDays: number },
  context: ToolExecutionContext,
): Promise<unknown> {
  if (context.mode !== 'demo') {
    throw new Error('get_demo_stats_for_contractor is only available in demo mode');
  }

  const roleInfo = await getOrCreateDemoRoleInfo(context.userId);
  if (roleInfo?.role !== 'contractor') {
    throw new Error('Contractor stats are only available for the contractor demo role');
  }

  const projects = await listAllDemoProjects();
  const contractorProjects = projects.filter(
    (p) => p.contractorId === 'contractor-john-smith',
  );

  const totalJobs = contractorProjects.length;
  const completedJobs = contractorProjects.filter(
    (p) => p.status === 'completed',
  ).length;

  return {
    contractorId: 'contractor-john-smith',
    lookbackDays: args.lookbackDays,
    totalJobs,
    completedJobs,
  };
}

async function createDemoMapSessionLink(
  args: { ttlHours?: number },
  context: ToolExecutionContext,
): Promise<{ url: string; token: string; expiresAt: string; role: DemoRole | null }> {
  if (context.mode !== 'demo') {
    throw new Error('create_demo_map_session_link is only available in demo mode');
  }

  const roleInfo = await getOrCreateDemoRoleInfo(context.userId);
  if (!roleInfo) {
    throw new Error(
      'No demo role is set for this user. Ask them to choose resident, city worker, or contractor first.',
    );
  }

  const ttlHours = args.ttlHours ?? 1;
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

  await saveDemoSessionToken({
    token,
    userId: context.userId,
    role: roleInfo.role,
    mode: 'demo',
    primaryReportId: roleInfo.primaryDemoReportId,
    createdAt: now.toISOString(),
    expiresAt,
  });

  const baseUrl = SITE_URL.replace(/\/$/, '');
  const url = `${baseUrl}/demo-map?token=${encodeURIComponent(token)}`;

  return { url, token, expiresAt, role: roleInfo.role };
}

async function ensureUserOwnsReport(userId: string, reportId: string): Promise<DamageReportBlob> {
  const report = await getReportById(userId, reportId);
  if (!report) {
    throw new Error('Report not found for this user');
  }
  return report;
}


