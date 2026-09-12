import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../prisma';
import { signTenantToken } from '../auth/jwt';
import { createSession } from '../auth/sessionService';
import { sanitizeUser } from './authController';
import {
  createPendingRegistration,
  verifyRegistrationCode,
  resendVerificationCode,
  sendWelcomeEmail,
  normalizeEmail,
  maskEmail,
} from '../auth/emailVerificationService';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';

const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60).optional(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(60).optional(),
  email: z.string().email('Invalid email address').transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  useTemporaryPassword: z.boolean().optional().default(false),
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters').max(100).optional(),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(100).optional(),
  branchName: z.string().min(2, 'Branch name must be at least 2 characters').max(100).default('Main Branch'),
  plan: z.string().optional().default('STARTER'),
  subdomain: z.string().optional(),
  code: z.string().optional(),
}).transform((data) => ({
  ...data,
  name: (data.name || data.fullName || 'Restaurant Owner').trim(),
  restaurantName: (data.restaurantName || data.businessName || 'Tillora Restaurant').trim(),
}));

const VerifyEmailSchema = z.object({
  email: z.string().email('Invalid email address').transform((s) => s.toLowerCase().trim()),
  code: z.string().min(6, 'Verification code must be 6 digits').max(6),
  pendingId: z.string().optional(),
  mustChangePassword: z.boolean().optional(),
  useTemporaryPassword: z.boolean().optional(),
});

const ResendVerificationSchema = z.object({
  email: z.string().email('Invalid email address').transform((s) => s.toLowerCase().trim()),
});

/**
 * Initiates Organization Registration:
 * Validates input, hashes credentials, generates a 6-digit verification code,
 * stores it safely (hashed) in PendingRegistration, and dispatches the verification email.
 */
export async function initiateRegistrationHandler(req: Request, res: Response): Promise<Response> {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { name, email, password, useTemporaryPassword, restaurantName, branchName, plan } = parseResult.data;
    const canonicalEmail = normalizeEmail(email);

    if (!password && !useTemporaryPassword) {
      return res.status(400).json({
        error: 'Validation failed: Password is required or select useTemporaryPassword',
      });
    }

    // 1. Check duplicate active user account belonging to an organization
    const existingUser = await prisma.user.findFirst({
      where: { username: canonicalEmail },
      include: { organization: true },
    });

    if (existingUser && existingUser.organizationId) {
      return res.status(409).json({
        error: 'An account with this email already exists and is linked to an organization.',
      });
    }

    // 2. Hash password securely or mark for temporary password generation
    let hashedPassword = '';
    if (useTemporaryPassword || !password) {
      hashedPassword = 'TEMP:' + (await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 10));
    } else {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // 3. Create Pending Registration and Dispatch Verification Email
    const pendingResult = await createPendingRegistration({
      name,
      email: canonicalEmail,
      passwordHash: hashedPassword,
      restaurantName,
      branchName,
      plan,
      ipAddress: req.ip,
    });

    // 4. Log Registration Started Audit Event
    await logAuditEvent({
      organizationId: 'PENDING_REGISTRATION',
      action: AUDIT_ACTIONS.REGISTRATION_STARTED,
      entity: 'PENDING_REGISTRATION',
      entityId: pendingResult.pendingId,
      metadata: {
        emailMasked: pendingResult.emailMasked,
        restaurantName,
        useTemporaryPassword: !!useTemporaryPassword,
      },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      requiresVerification: true,
      message: `Verification code sent to ${pendingResult.emailMasked}`,
      emailMasked: pendingResult.emailMasked,
      pendingId: pendingResult.pendingId,
      expiresInMinutes: pendingResult.expiresInMinutes,
      previewCode: (pendingResult as any).previewCode,
    });
  } catch (error: any) {
    console.error('[InitiateRegistrationHandler] Error:', error);
    if (error.message && error.message.startsWith('RATE_LIMITED')) {
      return res.status(429).json({ error: error.message });
    }
    return res.status(500).json({
      error: 'Failed to initiate registration',
      details: error.message || 'Internal server error',
    });
  }
}

/**
 * Completes Organization Registration by Verifying Email:
 * Validates the 6-digit code against the stored hash.
 * If valid, performs an atomic, race-safe database transaction to provision
 * Organization, Branch, Owner User, and Subscription.
 */
export async function verifyEmailHandler(req: Request, res: Response): Promise<Response> {
  try {
    const parseResult = VerifyEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed. Please provide a valid email and 6-digit verification code.',
        details: parseResult.error.errors,
      });
    }

    const { email, code } = parseResult.data;
    const canonicalEmail = normalizeEmail(email);

    // 1. Verify Code
    const verifyResult = await verifyRegistrationCode(canonicalEmail, code, req.ip);
    if (!verifyResult.success) {
      const statusCode =
        verifyResult.code === 'LOCKED'
          ? 429
          : verifyResult.code === 'EXPIRED'
          ? 410
          : verifyResult.code === 'ALREADY_USED'
          ? 409
          : verifyResult.code === 'NOT_FOUND'
          ? 404
          : 400;

      return res.status(statusCode).json({
        error: verifyResult.error,
        code: verifyResult.code,
        attemptsRemaining: (verifyResult as any).attemptsRemaining,
      });
    }

    const pending = verifyResult.pending;

    // 2. Check if this owner email has EVER consumed a trial in the system
    const previousTrialConsumption = await prisma.organization.findFirst({
      where: {
        users: {
          some: { username: canonicalEmail },
        },
        trialUsedAt: { not: null },
      },
    });

    const isEligibleForTrial = !previousTrialConsumption;

    // 3. Generate slugs
    const orgSlug =
      pending.restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString().slice(-4);
    const branchSlug = pending.branchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // 4. Temporary Password Resolution & mustChangePassword
    let assignedPin = pending.passwordHash;
    let userMustChangePassword =
      parseResult.data.mustChangePassword !== undefined ? parseResult.data.mustChangePassword : true;
    let generatedTempPassword: string | null = null;

    if (parseResult.data.useTemporaryPassword || pending.passwordHash.startsWith('TEMP:')) {
      generatedTempPassword = 'TEMP:' + crypto.randomBytes(4).toString('hex') + '!' + crypto.randomInt(10, 99);
      assignedPin = await bcrypt.hash(generatedTempPassword, 10);
      userMustChangePassword = true;
    }

    // 5. Atomic Transaction: Provision Organization, Branch, Owner, Subscription, BranchAssignment
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const trialDurationDays = 14;
      const trialExpirationDate = new Date(now.getTime() + trialDurationDays * 24 * 60 * 60 * 1000);

      // Create Organization
      const org = await tx.organization.create({
        data: {
          name: pending.restaurantName,
          slug: orgSlug,
          status: isEligibleForTrial ? 'TRIAL' : 'ACTIVE',
          trialUsedAt: isEligibleForTrial ? now : null, // Permanently records trial consumption
          settings: JSON.stringify({
            currency: 'USD',
            currencySymbol: '$',
            timezone: 'UTC',
            onboardingComplete: true,
          }),
        },
      });

      // Create Initial Branch
      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: pending.branchName || 'Main Branch',
          slug: branchSlug,
          active: true,
          settings: JSON.stringify({}),
        },
      });

      // Also create outlet record for POS sync compatibility
      await tx.outlet.create({
        data: {
          organizationId: org.id,
          name: pending.branchName || 'Main Branch',
          address: '',
          phone: '',
          active: true,
        },
      }).catch(() => {});

      // Create Owner User
      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          name: pending.name,
          username: canonicalEmail,
          pin: assignedPin,
          role: 'OWNER',
          active: true,
          mustChangePassword: userMustChangePassword,
        },
      });

      // Create UserBranchAssignment (Phase 22)
      await tx.userBranchAssignment.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          branchId: branch.id,
        },
      });

      // Initialize Subscription
      const validPlans = ['FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE'];
      const targetPlan = validPlans.includes((pending.plan || '').toUpperCase())
        ? pending.plan.toUpperCase()
        : 'STARTER';

      const subscription = await tx.subscription.create({
        data: {
          organizationId: org.id,
          plan: targetPlan,
          status: isEligibleForTrial ? 'TRIALING' : 'ACTIVE',
          startDate: now,
          trialEndsAt: isEligibleForTrial ? trialExpirationDate : null,
        },
      });

      // Audit Logs
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          userId: user.id,
          action: AUDIT_ACTIONS.OWNER_ACCOUNT_CREATED,
          entity: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            username: canonicalEmail,
            role: 'OWNER',
            mustChangePassword: userMustChangePassword,
          }),
          ipAddress: req.ip,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          userId: user.id,
          action: AUDIT_ACTIONS.ACCOUNT_CREATED,
          entity: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            username: canonicalEmail,
            role: 'OWNER',
            mustChangePassword: userMustChangePassword,
          }),
          ipAddress: req.ip,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          userId: user.id,
          action: AUDIT_ACTIONS.OWNER_EMAIL_VERIFIED,
          entity: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            emailMasked: maskEmail(canonicalEmail),
          }),
          ipAddress: req.ip,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          userId: user.id,
          action: AUDIT_ACTIONS.ORGANIZATION_CREATED,
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

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          userId: user.id,
          action: AUDIT_ACTIONS.OWNER_ASSIGNED,
          entity: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            username: canonicalEmail,
            role: 'OWNER',
          }),
          ipAddress: req.ip,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          userId: user.id,
          action: AUDIT_ACTIONS.BRANCH_CREATED,
          entity: 'BRANCH',
          entityId: branch.id,
          metadata: JSON.stringify({
            branchName: branch.name,
          }),
          ipAddress: req.ip,
        },
      });

      // Clean up the verified pending registration
      await tx.pendingRegistration.delete({
        where: { id: pending.id },
      }).catch(() => {});

      return { org, branch, user, subscription };
    });

    // 6. Create Active Security Session
    const session = await createSession({
      userId: result.user.id,
      organizationId: result.org.id,
      branchId: result.branch.id,
      ipAddress: req.ip || '',
      deviceInfo: req.headers['user-agent'] || 'Unknown',
    });

    // 7. Sign JWT Tenant Token
    const token = signTenantToken({
      userId: result.user.id,
      organizationId: result.org.id,
      branchId: result.branch.id,
      sessionId: session?.id,
      role: result.user.role,
      name: result.user.name,
      mustChangePassword: result.user.mustChangePassword,
    });

    // 8. Dispatch Welcome Email
    const loginUrl = (process.env.PUBLIC_URL || req.headers.origin || 'https://www.tillora.net') + '/login';
    let welcomeEmailDelivered = false;

    try {
      await sendWelcomeEmail({
        email: canonicalEmail,
        name: pending.name,
        restaurantName: result.org.name,
        role: 'OWNER',
        branches: [result.branch.name],
        loginUrl,
        temporaryPassword: generatedTempPassword || undefined,
        mustChangePassword: result.user.mustChangePassword,
        planName: result.subscription.plan,
        isTrial: isEligibleForTrial,
      });
      welcomeEmailDelivered = true;

      // 9. Record Welcome Email Sent Audit Log
      await logAuditEvent({
        organizationId: result.org.id,
        branchId: result.branch.id,
        userId: result.user.id,
        action: AUDIT_ACTIONS.OWNER_WELCOME_EMAIL_SENT,
        entity: 'USER',
        entityId: result.user.id,
        metadata: {
          emailMasked: maskEmail(canonicalEmail),
          restaurantName: result.org.name,
          branches: [result.branch.name],
          mustChangePassword: result.user.mustChangePassword,
        },
        ipAddress: req.ip,
      }).catch(() => {});

      await logAuditEvent({
        organizationId: result.org.id,
        branchId: result.branch.id,
        userId: result.user.id,
        action: AUDIT_ACTIONS.WELCOME_EMAIL_SENT,
        entity: 'USER',
        entityId: result.user.id,
        metadata: {
          emailMasked: maskEmail(canonicalEmail),
          restaurantName: result.org.name,
          branches: [result.branch.name],
          mustChangePassword: result.user.mustChangePassword,
        },
        ipAddress: req.ip,
      }).catch(() => {});
    } catch (err: any) {
      console.error('[VerifyEmailHandler] Failed to dispatch welcome email:', err.message);
      await logAuditEvent({
        organizationId: result.org.id,
        branchId: result.branch.id,
        userId: result.user.id,
        action: AUDIT_ACTIONS.OWNER_WELCOME_EMAIL_FAILED,
        entity: 'USER',
        entityId: result.user.id,
        metadata: {
          emailMasked: maskEmail(canonicalEmail),
          restaurantName: result.org.name,
          error: err.message || 'SMTP delivery failure',
        },
        ipAddress: req.ip,
      }).catch(() => {});
    }

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
      success: true,
      message: 'Account and organization activated successfully!',
      token,
      user: safeUser,
      organization: safeOrg,
      organizationId: result.org.id,
      branchId: result.branch.id,
      username: canonicalEmail,
      branch: safeBranch,
      subscription: {
        id: result.subscription.id,
        plan: result.subscription.plan,
        status: result.subscription.status,
        trialEndsAt: result.subscription.trialEndsAt,
      },
      mustChangePassword: result.user.mustChangePassword,
      temporaryPassword: generatedTempPassword || undefined,
      welcomeEmailSent: true,
    });
  } catch (error: any) {
    console.error('[VerifyEmailHandler] Error:', error);
    return res.status(500).json({
      error: 'Failed to verify email and activate organization',
      details: error.message || 'Internal database error',
    });
  }
}

/**
 * Resends Verification Code:
 * Enforces rate limiting cooldown between resend requests.
 */
export async function resendVerificationHandler(req: Request, res: Response): Promise<Response> {
  try {
    const parseResult = ResendVerificationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed. Please provide a valid email address.',
        details: parseResult.error.errors,
      });
    }

    const { email } = parseResult.data;
    const result = await resendVerificationCode(email, req.ip);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[ResendVerificationHandler] Error:', error);
    if (error.message && error.message.startsWith('RATE_LIMITED')) {
      return res.status(429).json({ error: error.message });
    }
    if (error.message && error.message.startsWith('NOT_FOUND')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: 'Failed to resend verification code',
      details: error.message || 'Internal server error',
    });
  }
}

/**
 * Universal Registration Handler:
 * If a `code` is provided in the request body, processes verification and activation.
 * Otherwise, initiates the registration and dispatches the email verification code.
 */
export async function registerHandler(req: Request, res: Response) {
  if (req.body && req.body.code) {
    return verifyEmailHandler(req, res);
  }
  return initiateRegistrationHandler(req, res);
}
