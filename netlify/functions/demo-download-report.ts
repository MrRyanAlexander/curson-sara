import type { Handler } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { IS_DEMO } from '../../src/config.js';
import { seedDemoDataIfNeeded } from '../../src/demo/seed-demo-data.js';
import { getDemoSessionToken, listAllDemoDamageReports } from '../../src/utils/blobs.js';

export const handler: Handler = async (event) => {
  connectLambda(event as any);

  if (!IS_DEMO) {
    return {
      statusCode: 400,
      body: 'Demo download is only available in demo mode',
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
  const reportId = event.queryStringParameters?.reportId;

  if (!token || !reportId) {
    return {
      statusCode: 400,
      body: 'token and reportId are required',
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

  const reports = await listAllDemoDamageReports();
  const report = reports.find((r) => r.id === reportId) ?? null;
  if (!report) {
    return {
      statusCode: 404,
      body: 'Report not found',
    };
  }

  const payload = {
    demo: true,
    simulationNotice:
      'DEMO ONLY: This report is part of a fictional Hurricane Santa simulation in Saraville.',
    report,
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="demo-report-${encodeURIComponent(report.id)}.json"`,
    },
    body: JSON.stringify(payload, null, 2),
  };
};
