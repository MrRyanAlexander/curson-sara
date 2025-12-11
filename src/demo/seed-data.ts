import type {
  DemoAreaStats,
  DemoContractorStats,
  DemoDamageReport,
  DemoProject,
} from './demo-types.js';

export interface DemoSeedData {
  damageReports: DemoDamageReport[];
  projects: DemoProject[];
  areaStats: DemoAreaStats[];
  contractorStats: DemoContractorStats[];
}

// Canonical fictional data for Hurricane Santa in Saraville.
export const DEMO_SEED_DATA: DemoSeedData = {
  damageReports: [
    {
      id: 'report-john-doe-home',
      residentName: 'John Doe',
      address: '123 Bayview Lane, Saraville',
      geo: { lat: 29.501, lng: -90.751 },
      damageType: 'Roof damage and minor interior flooding',
      insuranceInfo: 'Homeowners policy with 2% hurricane deductible',
      helpRequested: 'Tarping, debris removal, and inspection for hidden water damage',
      status: 'in_progress',
      assignedContractorId: 'contractor-john-smith',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: 'report-high-school-gym',
      residentName: 'Saraville High School',
      address: '1 Wildcat Way, Saraville',
      geo: { lat: 29.505, lng: -90.748 },
      damageType: 'Roof damage and blown-out windows at gym',
      insuranceInfo: 'City facilities coverage',
      helpRequested: 'Temporary roofing, board-up, and electrical inspection',
      status: 'in_progress',
      assignedContractorId: 'contractor-john-smith',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: 'report-riverside-apartments',
      residentName: 'Riverside Apartments',
      address: '400 Riverfront Drive, Saraville',
      geo: { lat: 29.498, lng: -90.745 },
      damageType: 'Flooding in ground-floor units, damaged HVAC',
      insuranceInfo: 'Mixed flood and property coverage; some tenants uninsured',
      helpRequested: 'Pumping out water, mold inspection, temporary housing coordination',
      status: 'completed',
      assignedContractorId: 'contractor-john-smith',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
  ],
  projects: [
    {
      id: 'project-john-doe-roof',
      contractorId: 'contractor-john-smith',
      reportId: 'report-john-doe-home',
      status: 'in_progress',
      notes:
        'Initial walkthrough completed, temporary tarp installed, and full roof replacement scheduled.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: 'project-high-school-gym',
      contractorId: 'contractor-john-smith',
      reportId: 'report-high-school-gym',
      status: 'in_progress',
      notes: 'Temporary roof in place, window board-up underway.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: 'project-riverside-apartments',
      contractorId: 'contractor-john-smith',
      reportId: 'report-riverside-apartments',
      status: 'completed',
      notes: 'Dry-out completed, final walkthrough with property manager done.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
  ],
  areaStats: [
    {
      id: 'saraville-core',
      name: 'Central Saraville',
      totalReports: 42,
      assignedCount: 30,
      inProgressCount: 8,
      completedCount: 4,
    },
    {
      id: 'saraville-riverfront',
      name: 'Riverfront District',
      totalReports: 27,
      assignedCount: 18,
      inProgressCount: 5,
      completedCount: 4,
    },
  ],
  contractorStats: [
    {
      contractorId: 'contractor-john-smith',
      contractorName: 'John Smith Roofing & Restoration',
      totalJobs: 25,
      completedJobs: 12,
      positiveFeedbackCount: 21,
    },
  ],
};
