import type { Handler } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { IS_DEMO } from '../../src/config.js';
import { seedDemoDataIfNeeded } from '../../src/demo/seed-demo-data.js';
import {
  getDemoSessionToken,
  getMessagesForUser,
  getUserById,
  listAllDemoDamageReports,
  listAllDemoProjects,
} from '../../src/utils/blobs.js';
import { getOrCreateDemoRoleInfo } from '../../src/demo/demo-roles.js';
import { toLlmUserProfile } from '../../src/utils/users.js';

export const handler: Handler = async (event) => {
  connectLambda(event as any);

  if (!IS_DEMO) {
    return {
      statusCode: 400,
      body: 'Demo map session is only available in demo mode',
    };
  }

  await seedDemoDataIfNeeded();

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  const token = event.queryStringParameters?.token;

  const [allReports, allProjects] = await Promise.all([
    listAllDemoDamageReports(),
    listAllDemoProjects(),
  ]);

  // If no token is provided, return a default Saraville demo view without
  // binding to a specific user or role. This is the standard entrypoint for
  // the map + chat demo.
  if (!token) {
    const canonicalId = 'report-john-doe-home';
    let primaryReport =
      allReports.find((r) => r.id === canonicalId) ??
      allReports.find((r) => r.geo) ??
      allReports[0] ??
      null;
    const primaryProject = primaryReport
      ? allProjects.find((p) => p.reportId === primaryReport.id) ?? null
      : null;

    let mapCenter: { lat: number; lng: number } | null = null;
    if (primaryReport?.geo) {
      mapCenter = { lat: primaryReport.geo.lat, lng: primaryReport.geo.lng };
    } else if (allReports.length > 0 && allReports[0].geo) {
      mapCenter = { lat: allReports[0].geo.lat, lng: allReports[0].geo.lng };
    } else {
      mapCenter = { lat: 29.5, lng: -90.75 };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        simulationNotice:
          'This is a DEMO simulation of Hurricane Santa in the fictional town of Saraville. It is not an official damage reporting channel.',
        token: null,
        userId: null,
        role: null,
        userProfile: null,
        primaryReport,
        primaryProject,
        mapCenter,
        mapData: {
          reports: allReports,
        },
        messages: [],
      }),
    };
  }

  const session = await getDemoSessionToken(token);
  if (!session) {
    return {
      statusCode: 404,
      body: 'Session not found',
    };
  }

  const now = new Date();
  if (new Date(session.expiresAt).getTime() <= now.getTime()) {
    return {
      statusCode: 410,
      body: 'Demo session expired',
    };
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return {
      statusCode: 404,
      body: 'User not found for session',
    };
  }

  const [messages, roleInfo] = await Promise.all([
    getMessagesForUser(user.id),
    getOrCreateDemoRoleInfo(user.id),
  ]);

  const userProfile = toLlmUserProfile(user, [], roleInfo ?? undefined);

  const primaryReportId =
    session.primaryReportId ?? roleInfo?.primaryDemoReportId ?? undefined;
  const primaryReport = primaryReportId
    ? allReports.find((r) => r.id === primaryReportId) ?? null
    : null;
  const primaryProject = primaryReport
    ? allProjects.find((p) => p.reportId === primaryReport.id) ?? null
    : null;

  let mapCenter: { lat: number; lng: number } | null = null;
  if (primaryReport?.geo) {
    mapCenter = { lat: primaryReport.geo.lat, lng: primaryReport.geo.lng };
  } else if (allReports.length > 0 && allReports[0].geo) {
    mapCenter = { lat: allReports[0].geo.lat, lng: allReports[0].geo.lng };
  }

  let roleMapPayload: unknown;
  if (session.role === 'resident') {
    const totalReports = allReports.length;
    const assignedCount = allReports.filter((r) => !!r.assignedContractorId).length;
    const completedCount = allReports.filter(
      (r) => r.status === 'completed' || r.status === 'resolved',
    ).length;
    const inProgressCount = allReports.filter((r) => r.status === 'in_progress').length;

    // Simple contractor popularity by number of jobs.
    const contractorJobCounts: Record<string, number> = {};
    for (const p of allProjects) {
      contractorJobCounts[p.contractorId] = (contractorJobCounts[p.contractorId] ?? 0) + 1;
    }
    const topContractors = Object.entries(contractorJobCounts)
      .map(([contractorId, jobCount]) => ({ contractorId, jobCount }))
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 5);

    roleMapPayload = {
      totals: {
        totalReports,
        assignedCount,
        inProgressCount,
        completedCount,
      },
      topContractors,
    };
  } else if (session.role === 'city') {
    roleMapPayload = {
      reports: allReports,
    };
  } else if (session.role === 'contractor') {
    const contractorId = 'contractor-john-smith';
    const contractorProjects = allProjects.filter((p) => p.contractorId === contractorId);
    const contractorReports = allReports.filter((r) =>
      contractorProjects.some((p) => p.reportId === r.id),
    );
    roleMapPayload = {
      projects: contractorProjects,
      reports: contractorReports,
    };
  } else {
    roleMapPayload = {
      message: 'No demo role set for this session.',
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      simulationNotice:
        'This is a DEMO simulation of Hurricane Santa in the fictional town of Saraville. It is not an official damage reporting channel.',
      token,
      userId: user.id,
      role: session.role,
      userProfile,
      primaryReport,
      primaryProject,
      mapCenter,
      mapData: roleMapPayload,
      messages,
    }),
  };
};
