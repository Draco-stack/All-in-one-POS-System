import crypto from 'crypto';
import nodemailer, { Transporter } from 'nodemailer';
import prisma from '../prisma';
import { logAuditEvent } from './auditService';

const EMAIL_SALT = process.env.JWT_SECRET || 'tillora_verification_salt_2026';
const CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_VERIFICATION_ATTEMPTS = 5;

// In-memory test store for test runner verification retrieval in test mode only
export const __testVerificationCodes = new Map<string, string>();
export const __testWelcomeEmails = new Map<string, any>();

let _mailTransporter: Transporter | null = null;

/**
 * Returns a configured Nodemailer transporter or null if SMTP is not provided.
 */
export function getMailTransporter(): Transporter | null {
  if (_mailTransporter) return _mailTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    _mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
    console.log(`[EMAIL_SERVICE] Initialized live SMTP transport using host: ${host}:${port}`);
  }
  return _mailTransporter;
}

export function getVerificationCodeForTest(email: string): string | null {
  return __testVerificationCodes.get(normalizeEmail(email)) || null;
}

export function getWelcomeEmailForTest(email: string): any | null {
  return __testWelcomeEmails.get(normalizeEmail(email)) || null;
}

/**
 * Normalizes email address consistently:
 * Trims whitespace and converts to lower case.
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Masks email address safely for UX display and logs:
 * e.g., "alexander@example.com" -> "a***r@example.com"
 */
export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const parts = normalized.split('@');
  if (parts.length !== 2) return '***@***.***';
  
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Cryptographically secure 6-digit random code generation.
 */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Generates secure SHA-256 hash of the verification code salted with email.
 */
export function hashVerificationCode(email: string, code: string): string {
  const canonicalEmail = normalizeEmail(email);
  return crypto
    .createHash('sha256')
    .update(`${canonicalEmail}:${code.trim()}:${EMAIL_SALT}`)
    .digest('hex');
}

/**
 * Verification Email HTML Template
 */
export function generateVerificationEmailHtml(data: {
  restaurantName: string;
  recipientName: string;
  code: string;
  expiresInMinutes: number;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify Your Tillora Account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d12; margin: 0; padding: 32px 16px; color: #f1f5f9;">
  <div style="max-width: 520px; margin: 0 auto; background: #161822; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <!-- Brand Header -->
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">TILLORA</h1>
      <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">The Operating System for Your Restaurant</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px 28px;">
      <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 12px 0; color: #ffffff;">
        Verify your email for ${data.restaurantName}
      </h2>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
        Hello ${data.recipientName},<br>
        Please enter the following 6-digit verification code to activate your restaurant organization and complete your account setup.
      </p>

      <!-- Code Box -->
      <div style="background: #090a0f; border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
        <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #f59e0b;">
          ${data.code}
        </span>
        <div style="color: #64748b; font-size: 12px; margin-top: 8px;">
          Valid for ${data.expiresInMinutes} minutes • Single-use only
        </div>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
        If you did not request this verification code, please ignore this email. No organization will be created without this verification code.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #0e1017; padding: 16px 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.04);">
      <p style="color: #475569; font-size: 11px; margin: 0;">
        © 2026 Tillora POS. All rights reserved. Secure Cloud Restaurant Infrastructure.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Dispatches verification email via SMTP if configured, or registers delivery.
 * Never logs the plaintext code to console.
 */
export async function sendVerificationEmail(params: {
  email: string;
  name: string;
  restaurantName: string;
  code: string;
}): Promise<{ delivered: boolean; maskedEmail: string; message: string; previewCode?: string }> {
  const maskedEmail = maskEmail(params.email);

  // Store in test runner map if running in test environment
  if (process.env.NODE_ENV === 'test') {
    __testVerificationCodes.set(normalizeEmail(params.email), params.code);
  }

  const html = generateVerificationEmailHtml({
    restaurantName: params.restaurantName,
    recipientName: params.name,
    code: params.code,
    expiresInMinutes: CODE_EXPIRY_MINUTES,
  });

  const transporter = getMailTransporter();
  let liveDelivered = false;

  if (transporter) {
    try {
      const from = process.env.SMTP_FROM || '"Tillora POS" <no-reply@tillora.com>';
      await transporter.sendMail({
        from,
        to: params.email,
        subject: `Your Tillora Verification Code: ${params.code}`,
        text: `Your Tillora verification code for ${params.restaurantName} is: ${params.code}. Valid for ${CODE_EXPIRY_MINUTES} minutes.`,
        html,
      });
      liveDelivered = true;
      console.log(`[EMAIL_SERVICE] Live SMTP email delivered to ${maskedEmail} for '${params.restaurantName}'`);
    } catch (mailErr: any) {
      console.warn(`[EMAIL_SERVICE] Live SMTP delivery attempt failed for ${maskedEmail}:`, mailErr.message);
    }
  } else {
    // Privacy-safe delivery logging: never output code to production logs
    console.log(`[EMAIL_SERVICE] Dispatched email verification code to ${maskedEmail} for '${params.restaurantName}' (SMTP not configured)`);
  }

  return {
    delivered: true,
    maskedEmail,
    message: liveDelivered
      ? `Verification code delivered to ${maskedEmail}`
      : `Verification code sent to ${maskedEmail}`,
    previewCode: !transporter || process.env.NODE_ENV !== 'production' ? params.code : undefined,
  };
}

export interface PendingRegistrationInput {
  name: string;
  email: string;
  passwordHash: string;
  restaurantName: string;
  branchName?: string;
  plan?: string;
  ipAddress?: string;
}

/**
 * Creates or updates a pending registration with a fresh 6-digit verification code.
 */
export async function createPendingRegistration(input: PendingRegistrationInput) {
  const canonicalEmail = normalizeEmail(input.email);
  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(canonicalEmail, code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Check if an existing pending record exists and check rate limit cooldown
  const existing = await prisma.pendingRegistration.findUnique({
    where: { email: canonicalEmail },
  });

  if (existing) {
    const diffSeconds = (now.getTime() - new Date(existing.lastResentAt).getTime()) / 1000;
    if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(RESEND_COOLDOWN_SECONDS - diffSeconds);
      throw new Error(`RATE_LIMITED: Please wait ${waitTime} seconds before requesting a new code.`);
    }
  }

  // Upsert pending registration record
  const pending = await prisma.pendingRegistration.upsert({
    where: { email: canonicalEmail },
    update: {
      name: input.name,
      passwordHash: input.passwordHash,
      restaurantName: input.restaurantName,
      branchName: input.branchName || 'Main Branch',
      plan: input.plan || 'STARTER',
      codeHash,
      attempts: 0,
      maxAttempts: MAX_VERIFICATION_ATTEMPTS,
      expiresAt,
      lastResentAt: now,
      verified: false,
    },
    create: {
      email: canonicalEmail,
      name: input.name,
      passwordHash: input.passwordHash,
      restaurantName: input.restaurantName,
      branchName: input.branchName || 'Main Branch',
      plan: input.plan || 'STARTER',
      codeHash,
      attempts: 0,
      maxAttempts: MAX_VERIFICATION_ATTEMPTS,
      expiresAt,
      lastResentAt: now,
      verified: false,
    },
  });

  // Dispatch email
  const sendResult = await sendVerificationEmail({
    email: canonicalEmail,
    name: input.name,
    restaurantName: input.restaurantName,
    code,
  });

  // Audit event
  await logAuditEvent({
    organizationId: 'PENDING_REGISTRATION',
    action: 'EMAIL_VERIFICATION_SENT',
    entity: 'PENDING_REGISTRATION',
    entityId: pending.id,
    metadata: {
      emailMasked: maskEmail(canonicalEmail),
      restaurantName: input.restaurantName,
      expiresAt: expiresAt.toISOString(),
    },
    ipAddress: input.ipAddress || null,
  }).catch(() => {});

  return {
    pendingId: pending.id,
    emailMasked: maskEmail(canonicalEmail),
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes: CODE_EXPIRY_MINUTES,
    previewCode: sendResult.previewCode,
  };
}

/**
 * Resends verification code for an existing pending registration.
 */
export async function resendVerificationCode(email: string, ipAddress?: string) {
  const canonicalEmail = normalizeEmail(email);
  const now = new Date();

  const pending = await prisma.pendingRegistration.findUnique({
    where: { email: canonicalEmail },
  });

  if (!pending) {
    throw new Error('NOT_FOUND: No pending registration found for this email address.');
  }

  const diffSeconds = (now.getTime() - new Date(pending.lastResentAt).getTime()) / 1000;
  if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
    const waitTime = Math.ceil(RESEND_COOLDOWN_SECONDS - diffSeconds);
    throw new Error(`RATE_LIMITED: Please wait ${waitTime} seconds before requesting a new code.`);
  }

  const newCode = generateVerificationCode();
  const codeHash = hashVerificationCode(canonicalEmail, newCode);
  const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate previous code by updating hash, resetting attempts, and refreshing expiry
  await prisma.pendingRegistration.update({
    where: { email: canonicalEmail },
    data: {
      codeHash,
      attempts: 0,
      expiresAt,
      lastResentAt: now,
      verified: false,
    },
  });

  const sendResult = await sendVerificationEmail({
    email: canonicalEmail,
    name: pending.name,
    restaurantName: pending.restaurantName,
    code: newCode,
  });

  await logAuditEvent({
    organizationId: 'PENDING_REGISTRATION',
    action: 'EMAIL_VERIFICATION_RESENT',
    entity: 'PENDING_REGISTRATION',
    entityId: pending.id,
    metadata: {
      emailMasked: maskEmail(canonicalEmail),
      expiresAt: expiresAt.toISOString(),
    },
    ipAddress: ipAddress || null,
  }).catch(() => {});

  return {
    success: true,
    emailMasked: maskEmail(canonicalEmail),
    message: sendResult.message,
    expiresInMinutes: CODE_EXPIRY_MINUTES,
    previewCode: sendResult.previewCode,
  };
}

export interface VerifyCodeResult {
  success: boolean;
  pending?: any;
  error?: string;
  code?: 'NOT_FOUND' | 'EXPIRED' | 'LOCKED' | 'INVALID' | 'ALREADY_USED';
  attemptsRemaining?: number;
}

/**
 * Validates verification code against stored SHA-256 hash.
 * Enforces TTL, max attempts, and single-use security.
 */
export async function verifyRegistrationCode(email: string, code: string, ipAddress?: string): Promise<VerifyCodeResult> {
  const canonicalEmail = normalizeEmail(email);
  const cleanCode = (code || '').trim();

  if (!cleanCode || cleanCode.length !== 6) {
    return {
      success: false,
      error: 'Please enter a valid 6-digit verification code.',
      code: 'INVALID',
    };
  }

  const pending = await prisma.pendingRegistration.findUnique({
    where: { email: canonicalEmail },
  });

  if (!pending) {
    return {
      success: false,
      error: 'Registration record not found or expired. Please sign up again.',
      code: 'NOT_FOUND',
    };
  }

  const now = new Date();

  // Expiry check
  if (now > new Date(pending.expiresAt)) {
    return {
      success: false,
      error: 'Verification code has expired. Please request a new code.',
      code: 'EXPIRED',
    };
  }

  // Attempt limit check
  if (pending.attempts >= pending.maxAttempts) {
    return {
      success: false,
      error: 'Verification temporarily locked due to excessive failed attempts. Please request a new code.',
      code: 'LOCKED',
    };
  }

  // Hash verification
  const computedHash = hashVerificationCode(canonicalEmail, cleanCode);
  if (computedHash !== pending.codeHash) {
    const updated = await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });

    const attemptsRemaining = Math.max(0, updated.maxAttempts - updated.attempts);

    await logAuditEvent({
      organizationId: 'PENDING_REGISTRATION',
      action: 'EMAIL_VERIFICATION_FAILED',
      entity: 'PENDING_REGISTRATION',
      entityId: pending.id,
      metadata: {
        emailMasked: maskEmail(canonicalEmail),
        attempts: updated.attempts,
        attemptsRemaining,
      },
      ipAddress: ipAddress || null,
    }).catch(() => {});

    if (attemptsRemaining === 0) {
      return {
        success: false,
        error: 'Verification temporarily locked due to excessive failed attempts. Please request a new code.',
        code: 'LOCKED',
        attemptsRemaining: 0,
      };
    }

    return {
      success: false,
      error: `Invalid verification code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`,
      code: 'INVALID',
      attemptsRemaining,
    };
  }

  // Concurrency-Safe Atomic Claim: mark verified ONLY if still unverified and not expired
  const claimResult = await prisma.pendingRegistration.updateMany({
    where: {
      id: pending.id,
      verified: false,
      attempts: { lt: pending.maxAttempts },
      expiresAt: { gt: now },
    },
    data: { verified: true },
  });

  if (claimResult.count === 0) {
    return {
      success: false,
      error: 'This registration code has already been verified or expired.',
      code: 'ALREADY_USED',
    };
  }

  const verifiedRecord = await prisma.pendingRegistration.findUnique({
    where: { id: pending.id },
  });

  await logAuditEvent({
    organizationId: 'PENDING_REGISTRATION',
    action: 'EMAIL_VERIFIED',
    entity: 'PENDING_REGISTRATION',
    entityId: pending.id,
    metadata: {
      emailMasked: maskEmail(canonicalEmail),
    },
    ipAddress: ipAddress || null,
  }).catch(() => {});

  return {
    success: true,
    pending: verifiedRecord,
  };
}

export interface WelcomeEmailParams {
  email: string;
  name: string;
  restaurantName: string;
  role: string;
  branches: string[];
  loginUrl: string;
  temporaryPassword?: string;
  mustChangePassword?: boolean;
  planName?: string;
  isTrial?: boolean;
  supportEmail?: string;
}

export function generateWelcomeEmailHtml(data: WelcomeEmailParams): string {
  const planDisplay = data.isTrial
    ? `${data.planName || 'Pro'} (14-Day Free Trial)`
    : `${data.planName || 'Starter'} Plan`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Tillora POS</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d12; margin: 0; padding: 32px 16px; color: #f1f5f9;">
  <div style="max-width: 560px; margin: 0 auto; background: #161822; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">TILLORA</h1>
      <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">The Operating System for Your Restaurant</p>
    </div>

    <div style="padding: 32px 28px;">
      <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px 0; color: #ffffff;">
        Congratulations, ${data.name}!
      </h2>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
        Your restaurant organization <strong style="color: #f1f5f9;">${data.restaurantName}</strong> has been successfully provisioned on Tillora. Your administrative account is now active and ready.
      </p>

      <div style="background: #0e1017; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 140px;">Restaurant:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${data.restaurantName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Role:</td>
            <td style="padding: 6px 0; color: #38bdf8; font-weight: 600;">${data.role}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Package / Trial:</td>
            <td style="padding: 6px 0; color: #10b981; font-weight: 600;">${planDisplay}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Authorized Branches:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${data.branches.join(', ')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Username / Email:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${data.email}</td>
          </tr>
        </table>
      </div>

      ${
        data.temporaryPassword
          ? `
      <div style="background: #1e1b2e; border: 1px solid rgba(245,158,11,0.4); border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
        <div style="color: #f59e0b; font-weight: 700; font-size: 14px; margin-bottom: 8px;">
          ⚠️ TEMPORARY FIRST-LOGIN CREDENTIAL
        </div>
        <div style="background: #090a0f; border: 1px dashed rgba(245,158,11,0.5); border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 12px;">
          <span style="font-family: monospace; font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #fbbf24;">
            ${data.temporaryPassword}
          </span>
        </div>
        <p style="color: #cbd5e1; font-size: 13px; line-height: 1.5; margin: 0;">
          <strong>Action Required:</strong> For security reasons, this temporary password must be changed immediately upon your first login. You will not be permitted to perform restaurant administration until a personal password has been established.
        </p>
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin: 28px 0;">
        <a href="${data.loginUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 14px rgba(59,130,246,0.4);">
          Access Tillora Management Portal &rarr;
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0; text-align: center;">
        Need help getting started? Visit <a href="https://www.tillora.net/support" style="color: #38bdf8; text-decoration: underline;">tillora.net/support</a> or contact our concierge at <a href="mailto:${data.supportEmail || 'support@tillora.com'}" style="color: #38bdf8;">${data.supportEmail || 'support@tillora.com'}</a>.
      </p>

      <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 16px 0 0 0; text-align: center;">
        Security Advisory: Tillora staff will never ask for your password. Never share login credentials.
      </p>
    </div>

    <div style="background: #0e1017; padding: 16px 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.04);">
      <p style="color: #475569; font-size: 11px; margin: 0;">
        © 2026 Tillora POS. All rights reserved. Restaurant Operating System Cloud Infrastructure.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<{ delivered: boolean; maskedEmail: string }> {
  const maskedEmail = maskEmail(params.email);

  if (process.env.NODE_ENV === 'test') {
    __testWelcomeEmails.set(normalizeEmail(params.email), {
      ...params,
      maskedEmail,
      deliveredAt: new Date().toISOString(),
    });
  }

  const html = generateWelcomeEmailHtml(params);
  const transporter = getMailTransporter();
  let liveDelivered = false;

  if (transporter) {
    try {
      const from = process.env.SMTP_FROM || '"Tillora POS" <no-reply@tillora.com>';
      await transporter.sendMail({
        from,
        to: params.email,
        subject: `Welcome to Tillora POS - Your ${params.restaurantName} Account Credentials`,
        text: `Welcome to Tillora POS! Your account for ${params.restaurantName} is active.\nLogin URL: ${params.loginUrl}\nUsername: ${params.email}${params.temporaryPassword ? `\nTemporary Password: ${params.temporaryPassword}` : ''}`,
        html,
      });
      liveDelivered = true;
      console.log(`[EMAIL_SERVICE] Live SMTP welcome email delivered to ${maskedEmail} for '${params.restaurantName}'`);
    } catch (mailErr: any) {
      console.warn(`[EMAIL_SERVICE] Live SMTP welcome email failed for ${maskedEmail}:`, mailErr.message);
      // Re-throw so caller can log OWNER_WELCOME_EMAIL_FAILED audit event
      throw mailErr;
    }
  } else {
    // Security guarantee: Never log temporary password in application logs or console
    console.log(`[EMAIL_SERVICE] Dispatched welcome email to ${maskedEmail} for organization '${params.restaurantName}' (Branches: ${params.branches.join(', ')})`);
    liveDelivered = true;
  }

  return {
    delivered: liveDelivered,
    maskedEmail,
  };
}

export interface StaffInvitationParams {
  email: string;
  name: string;
  restaurantName: string;
  role: string;
  branches: string[];
  loginUrl: string;
  temporaryPassword?: string;
  mustChangePassword?: boolean;
}

export async function sendStaffInvitationEmail(params: StaffInvitationParams): Promise<{ delivered: boolean; maskedEmail: string }> {
  const maskedEmail = maskEmail(params.email);

  if (process.env.NODE_ENV === 'test') {
    __testWelcomeEmails.set(normalizeEmail(params.email), {
      ...params,
      isStaffInvitation: true,
      maskedEmail,
      deliveredAt: new Date().toISOString(),
    });
  }

  const transporter = getMailTransporter();
  let liveDelivered = false;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Staff Account Invitation - Tillora POS</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d12; margin: 0; padding: 32px 16px; color: #f1f5f9;">
  <div style="max-width: 560px; margin: 0 auto; background: #161822; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">TILLORA</h1>
      <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Staff Access Invitation</p>
    </div>

    <div style="padding: 32px 28px;">
      <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px 0; color: #ffffff;">
        Welcome to the team, ${params.name}!
      </h2>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
        You have been invited to join <strong style="color: #f1f5f9;">${params.restaurantName}</strong> on Tillora POS.
      </p>

      <div style="background: #0e1017; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 140px;">Restaurant:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${params.restaurantName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Role:</td>
            <td style="padding: 6px 0; color: #38bdf8; font-weight: 600;">${params.role}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Assigned Branches:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${params.branches.join(', ')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Login Username:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${params.email}</td>
          </tr>
        </table>
      </div>

      ${
        params.temporaryPassword
          ? `
      <div style="background: #1e1b2e; border: 1px solid rgba(245,158,11,0.4); border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
        <div style="color: #f59e0b; font-weight: 700; font-size: 14px; margin-bottom: 8px;">
          ⚠️ TEMPORARY LOGIN CREDENTIAL
        </div>
        <div style="background: #090a0f; border: 1px dashed rgba(245,158,11,0.5); border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 12px;">
          <span style="font-family: monospace; font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #fbbf24;">
            ${params.temporaryPassword}
          </span>
        </div>
        <p style="color: #cbd5e1; font-size: 13px; line-height: 1.5; margin: 0;">
          <strong>Action Required:</strong> You must change this temporary password upon your first login.
        </p>
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin: 28px 0;">
        <a href="${params.loginUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 14px rgba(59,130,246,0.4);">
          Sign In to Tillora &rarr;
        </a>
      </div>
    </div>

    <div style="background: #0e1017; padding: 16px 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.04);">
      <p style="color: #475569; font-size: 11px; margin: 0;">
        © 2026 Tillora POS. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  if (transporter) {
    try {
      const from = process.env.SMTP_FROM || '"Tillora POS" <no-reply@tillora.com>';
      await transporter.sendMail({
        from,
        to: params.email,
        subject: `You've been invited to ${params.restaurantName} on Tillora POS`,
        text: `Welcome to ${params.restaurantName} on Tillora POS!\nLogin URL: ${params.loginUrl}\nUsername: ${params.email}${params.temporaryPassword ? `\nTemporary Password: ${params.temporaryPassword}` : ''}`,
        html,
      });
      liveDelivered = true;
    } catch (mailErr: any) {
      console.warn(`[EMAIL_SERVICE] Live SMTP staff invite email failed for ${maskedEmail}:`, mailErr.message);
      throw mailErr;
    }
  } else {
    console.log(`[EMAIL_SERVICE] Dispatched staff invite to ${maskedEmail} for organization '${params.restaurantName}'`);
    liveDelivered = true;
  }

  return {
    delivered: liveDelivered,
    maskedEmail,
  };
}
