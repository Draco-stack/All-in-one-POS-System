import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../prisma';
import { signTenantToken } from '../auth/jwt';
import { createSession } from '../auth/sessionService';
import { sanitizeUser } from './authController';

const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address').transform(s => s.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters').max(100),
  branchName: z.string().min(2, 'Branch name must be at least 2 characters').max(100).default('Main Branch'),
  plan: z.string().optional().default('STARTER'),
});

export async function registerHandler(req: Request, res: Response) {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { name, email, password, restaurantName, branchName, plan } = parseResult.data;

    // Check duplicate account or trial consumption
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findFirst({
      where: { username: normalizedEmail },
      include: { organization: true },
    });

    if (existingUser && existingUser.organizationId) {
      return res.status(409).json({ error: 'An account with this email already exists and is linked to an organization' });
    }

    // Check if this owner email has EVER consumed a trial in the system
    const previousTrialConsumption = await prisma.organization.findFirst({
      where: {
        users: {
          some: { username: normalizedEmail }
        },
        trialUsedAt: { not: null }
      }
    });

    const isEligibleForTrial = !previousTrialConsumption;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate slugs
    const orgSlug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);
    const branchSlug = branchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Transaction - Atomic & Race-Safe Creation
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const trialDurationDays = 14;
      const trialExpirationDate = new Date(now.getTime() + trialDurationDays * 24 * 60 * 60 * 1000);

      // Create Organization
      const org = await tx.organization.create({
        data: {
          name: restaurantName,
          slug: orgSlug,
          status: isEligibleForTrial ? 'TRIAL' : 'ACTIVE',
          trialUsedAt: isEligibleForTrial ? now : null, // Permanently records trial consumption
          settings: JSON.stringify({
            currency: 'USD',
            currencySymbol: '$',
            timezone: 'UTC',
            onboardingComplete: false,
          }),
        },
      });

      // Create Branch
      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: branchName,
          slug: branchSlug,
          active: true,
          settings: JSON.stringify({}),
        },
      });

      // Create or Update User (Owner)
      let user;
      if (existingUser) {
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            organizationId: org.id,
            branchId: branch.id,
            name,
            pin: hashedPassword,
            role: 'OWNER',
            active: true,
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            organizationId: org.id,
            branchId: branch.id,
            name,
            username: normalizedEmail, // use email as username
            pin: hashedPassword,
            role: 'OWNER',
            active: true,
          },
        });
      }

      // Initialize Subscription
      const validPlans = ['FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE'];
      const targetPlan = validPlans.includes(plan.toUpperCase()) ? plan.toUpperCase() : 'STARTER';
      
      const subscription = await tx.subscription.create({
        data: {
          organizationId: org.id,
          plan: targetPlan,
          status: isEligibleForTrial ? 'TRIALING' : 'ACTIVE',
          startDate: now,
          trialEndsAt: isEligibleForTrial ? trialExpirationDate : null,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          userId: user.id,
          action: isEligibleForTrial ? 'ORGANIZATION_TRIAL_STARTED' : 'ORGANIZATION_CREATED',
          entity: 'ORGANIZATION',
          entityId: org.id,
          metadata: JSON.stringify({
            plan: targetPlan,
            isTrial: isEligibleForTrial,
            trialEndsAt: isEligibleForTrial ? trialExpirationDate.toISOString() : null,
          }),
          ipAddress: req.ip,
        },
      });

      return { org, branch, user, subscription };
    });

    // Create session
    const session = await createSession({
      userId: result.user.id,
      organizationId: result.org.id,
      branchId: result.branch.id,
      ipAddress: req.ip || '',
      deviceInfo: req.headers['user-agent'] || 'Unknown',
    });

    const token = signTenantToken({
      userId: result.user.id,
      organizationId: result.org.id,
      branchId: result.branch.id,
      sessionId: session.id,
      role: result.user.role,
    });

    const safeUser = sanitizeUser(result.user);
    const safeOrg = {
      id: result.org.id,
      name: result.org.name,
      slug: result.org.slug,
      status: result.org.status,
    };
    const safeBranch = {
      id: result.branch.id,
      name: result.branch.name,
      slug: result.branch.slug,
      active: result.branch.active,
    };

    return res.status(201).json({
      token,
      user: safeUser,
      organization: safeOrg,
      branch: safeBranch,
    });
  } catch (error) {
    console.error('[RegisterHandler] Error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}
