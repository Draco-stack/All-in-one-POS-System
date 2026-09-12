import prisma from '../prisma';

export interface OnboardingStepResult {
  key: string;
  title: string;
  description: string;
  required: boolean;
  status: 'COMPLETED' | 'INCOMPLETE' | 'RECOMMENDED' | 'NOT_APPLICABLE';
  reason?: string;
  actionRoute?: string;
}

export interface ReadinessEvaluationResult {
  organizationId: string;
  onboardingStatus: string; // NOT_STARTED, IN_PROGRESS, READY, COMPLETED
  onboardingVersion: number;
  serviceModel: string;
  isReady: boolean;
  progressPercentage: number;
  steps: OnboardingStepResult[];
  blockingReasons: string[];
}

/**
 * Server-authoritative Readiness Evaluator for Restaurant Onboarding.
 * Calculates readiness dynamically from live server database state.
 */
export async function evaluateOnboardingReadiness(
  organizationId: string,
  branchId?: string
): Promise<ReadinessEvaluationResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      branches: true,
      users: true,
      categories: { where: { active: true } },
      menuItems: { where: { active: true } },
      tables: { where: { active: true } },
      devices: true,
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  const targetBranchId = branchId || org.branches[0]?.id;

  // Check test/training orders
  const testOrderCount = await prisma.order.count({
    where: {
      organizationId,
      isTraining: true,
    },
  });

  const anyOrderCount = await prisma.order.count({
    where: { organizationId },
  });

  let settingsObj: any = {};
  try {
    if (org.settings) {
      settingsObj = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings;
    }
  } catch (e) {}

  const serviceModel = org.serviceModel || 'HYBRID';
  const steps: OnboardingStepResult[] = [];

  // 1. Restaurant Profile
  const hasProfile = Boolean(org.name && org.name.trim().length > 0);
  steps.push({
    key: 'RESTAURANT_PROFILE',
    title: 'Restaurant Profile',
    description: 'Set your business name, currency, timezone, and contact details.',
    required: true,
    status: hasProfile ? 'COMPLETED' : 'INCOMPLETE',
    reason: hasProfile ? 'Profile configured' : 'Business name is required',
    actionRoute: '/portal?tab=restaurant',
  });

  // 2. Service Model
  const hasServiceModel = Boolean(serviceModel && serviceModel.length > 0);
  steps.push({
    key: 'SERVICE_MODEL',
    title: 'Service Model',
    description: 'Define your operational style (Dine-In, Counter, Takeaway, Hybrid).',
    required: true,
    status: hasServiceModel ? 'COMPLETED' : 'INCOMPLETE',
    reason: `Configured as ${serviceModel}`,
  });

  // 3. Branch Setup
  const activeBranches = org.branches.filter((b) => b.active);
  const hasBranch = activeBranches.length > 0;
  steps.push({
    key: 'BRANCH_SETUP',
    title: 'Branch Configuration',
    description: 'Verify your primary operational branch and address.',
    required: true,
    status: hasBranch ? 'COMPLETED' : 'INCOMPLETE',
    reason: hasBranch ? `${activeBranches.length} active branch(es)` : 'At least 1 active branch required',
    actionRoute: '/portal?tab=restaurant',
  });

  // 4. Tax & Financial Setup
  const primaryBranch = activeBranches.find((b) => b.id === targetBranchId) || activeBranches[0];
  const hasTaxConfig = primaryBranch ? primaryBranch.taxRate >= 0 : true;
  steps.push({
    key: 'TAX_FINANCIAL',
    title: 'Tax & Financial Rules',
    description: 'Configure standard tax rates and currency settings for receipts.',
    required: true,
    status: hasTaxConfig ? 'COMPLETED' : 'INCOMPLETE',
    reason: primaryBranch ? `Tax rate: ${primaryBranch.taxRate}%` : 'Tax rate verified',
    actionRoute: '/portal?tab=restaurant',
  });

  // 5. Menu Setup
  const validMenuItems = org.menuItems.filter((i) => i.price >= 0);
  const isMenuReady = org.categories.length > 0 && validMenuItems.length > 0;
  steps.push({
    key: 'MENU_READY',
    title: 'Menu Setup',
    description: 'Create active categories and menu items with valid prices.',
    required: true,
    status: isMenuReady ? 'COMPLETED' : 'INCOMPLETE',
    reason: isMenuReady
      ? `${org.categories.length} categories, ${validMenuItems.length} menu items ready`
      : 'At least 1 active category and 1 active menu item required',
    actionRoute: '/portal?tab=restaurant',
  });

  // 6. Floor & Tables
  const isTableServiceNeeded = serviceModel === 'DINE_IN' || serviceModel === 'HYBRID';
  if (!isTableServiceNeeded) {
    steps.push({
      key: 'TABLES_FLOOR',
      title: 'Floor & Tables',
      description: 'Configure dine-in floor layout and tables.',
      required: false,
      status: 'NOT_APPLICABLE',
      reason: `Not applicable for ${serviceModel} model`,
    });
  } else {
    const branchTables = org.tables.filter((t) => !targetBranchId || t.branchId === targetBranchId || !t.branchId);
    const hasTables = branchTables.length > 0;
    steps.push({
      key: 'TABLES_FLOOR',
      title: 'Floor & Tables',
      description: 'Add physical tables and seating capacity for dine-in service.',
      required: true,
      status: hasTables ? 'COMPLETED' : 'INCOMPLETE',
      reason: hasTables ? `${branchTables.length} table(s) configured` : 'Dine-in mode requires at least 1 table',
      actionRoute: '/portal?tab=restaurant',
    });
  }

  // 7. Kitchen & KDS
  const kdsDevices = org.devices.filter((d) => d.deviceType === 'KDS' || d.deviceType === 'PRINTER');
  steps.push({
    key: 'KITCHEN_KDS',
    title: 'Kitchen & Display System',
    description: 'Configure kitchen order routing or display screens.',
    required: false,
    status: kdsDevices.length > 0 ? 'COMPLETED' : 'RECOMMENDED',
    reason: kdsDevices.length > 0 ? `${kdsDevices.length} kitchen device(s) registered` : 'Recommended for kitchen workflow',
    actionRoute: '/portal?tab=devices',
  });

  // 8. Printers & Hardware Check
  const totalDevices = org.devices.length;
  steps.push({
    key: 'HARDWARE_DEVICES',
    title: 'Printers & Hardware',
    description: 'Register receipt printers or POS terminals.',
    required: false,
    status: totalDevices > 0 ? 'COMPLETED' : 'RECOMMENDED',
    reason: totalDevices > 0 ? `${totalDevices} device(s) registered` : 'Optional hardware setup',
    actionRoute: '/portal?tab=devices',
  });

  // 9. Staff Setup
  const activeStaff = org.users.filter((u) => u.active !== false);
  steps.push({
    key: 'STAFF_SETUP',
    title: 'Staff Administration',
    description: 'Invite team members and assign role-based permissions.',
    required: false,
    status: activeStaff.length > 1 ? 'COMPLETED' : 'RECOMMENDED',
    reason: activeStaff.length > 1 ? `${activeStaff.length} staff accounts configured` : 'Owner active. Add staff as needed.',
    actionRoute: '/portal?tab=team',
  });

  // 10. Inventory Setup
  const inventoryItems = Array.isArray(settingsObj.inventory) ? settingsObj.inventory : [];
  steps.push({
    key: 'INVENTORY_SETUP',
    title: 'Inventory Management',
    description: 'Track ingredient stock and supplier stock levels.',
    required: false,
    status: inventoryItems.length > 0 ? 'COMPLETED' : 'RECOMMENDED',
    reason: inventoryItems.length > 0 ? `${inventoryItems.length} inventory items tracked` : 'Optional inventory tracking',
  });

  // 11. Test Order Workflow
  const hasCompletedTestOrder = testOrderCount > 0 || anyOrderCount > 0;
  steps.push({
    key: 'TEST_ORDER',
    title: 'Safe Test Order Workflow',
    description: 'Execute a training test order to verify order punching, kitchen flow, and checkout.',
    required: true,
    status: hasCompletedTestOrder ? 'COMPLETED' : 'INCOMPLETE',
    reason: hasCompletedTestOrder ? 'Test order workflow verified' : 'Required: Perform 1 test transaction',
  });

  // Calculate blockers & progress
  const requiredSteps = steps.filter((s) => s.required);
  const incompleteRequired = requiredSteps.filter((s) => s.status === 'INCOMPLETE');
  const blockingReasons = incompleteRequired.map((s) => `${s.title}: ${s.reason}`);

  const applicableSteps = steps.filter((s) => s.status !== 'NOT_APPLICABLE');
  const completedCount = applicableSteps.filter((s) => s.status === 'COMPLETED').length;
  const progressPercentage = applicableSteps.length > 0
    ? Math.round((completedCount / applicableSteps.length) * 100)
    : 100;

  const isReady = incompleteRequired.length === 0;

  return {
    organizationId,
    onboardingStatus: org.onboardingStatus || 'NOT_STARTED',
    onboardingVersion: org.onboardingVersion || 1,
    serviceModel,
    isReady,
    progressPercentage,
    steps,
    blockingReasons,
  };
}
