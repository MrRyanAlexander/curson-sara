import type { DemoRole, DemoUserRoleInfo } from './demo-types.js';
import {
  deleteDemoRoleForUser,
  getDemoRoleForUser,
  saveDemoRoleForUser,
  updateUserDemoInfoById,
} from '../utils/blobs.js';

const ROLE_CONFIG: Record<
  DemoRole,
  {
    canonicalName: DemoUserRoleInfo['canonicalName'];
    primaryDemoReportId: string;
  }
> = {
  resident: {
    canonicalName: 'John Doe',
    // Primary household report for the resident.
    primaryDemoReportId: 'report-john-doe-home',
  },
  city: {
    canonicalName: 'Jane Smith',
    // City-focused facility report to anchor the scenario.
    primaryDemoReportId: 'report-high-school-gym',
  },
  contractor: {
    canonicalName: 'John Smith',
    // Contractor’s primary residential job for the demo.
    primaryDemoReportId: 'report-john-doe-home',
  },
};

export async function getOrCreateDemoRoleInfo(
  userId: string,
): Promise<DemoUserRoleInfo | null> {
  // For the demo, we only create role info once the user has explicitly
  // selected a role via `setDemoRole`. Until then this behaves like a simple
  // `get` and returns null.
  const existing = await getDemoRoleForUser(userId);
  return existing ?? null;
}

export async function setDemoRole(
  userId: string,
  role: DemoRole,
): Promise<DemoUserRoleInfo> {
  const config = ROLE_CONFIG[role];
  const roleInfo: DemoUserRoleInfo = {
    userId,
    role,
    canonicalName: config.canonicalName,
    primaryDemoReportId: config.primaryDemoReportId,
  };

  const saved = await saveDemoRoleForUser(userId, roleInfo);

  // Also mirror key demo fields onto the primary user profile blob so the
  // LLM context can include them even without hitting demo-role tools.
  await updateUserDemoInfoById(userId, {
    demoRole: role,
    demoCanonicalName: config.canonicalName,
  });

  return saved;
}

export async function clearDemoRole(userId: string): Promise<void> {
  await deleteDemoRoleForUser(userId);
  await updateUserDemoInfoById(userId, {
    demoRole: undefined,
    demoCanonicalName: undefined,
  });
}

export function getDefaultReportIdForRole(role: DemoRole, _userId: string): string {
  return ROLE_CONFIG[role].primaryDemoReportId;
}

