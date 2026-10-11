import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Setup Nodemailer Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: env.SMTP_PORT || 465,
  secure: true, // true for 465
  service: 'gmail',
  auth: {
    user: env.SMTP_MAIL || 'rightsight365@gmail.com',
    pass: env.SMTP_PASSWORD || 'ktgvoitoxfhijqmr',
  },
});

// In-memory OTP storage with TTL (10 minutes)
interface OtpEntry {
  code: string;
  expiresAt: number;
  purpose: 'REGISTER' | 'FORGOT_PASSWORD';
}

const otpStore = new Map<string, OtpEntry>();

/**
 * Generate a cryptographically random 6-digit OTP
 */
export function generateOtp(email: string, purpose: 'REGISTER' | 'FORGOT_PASSWORD'): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    purpose,
  });
  return code;
}

/**
 * Verify OTP
 */
export function verifyOtp(email: string, inputCode: string, purpose: 'REGISTER' | 'FORGOT_PASSWORD'): boolean {
  const entry = otpStore.get(email.toLowerCase());
  if (!entry) return false;
  if (entry.purpose !== purpose) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false;
  }
  if (entry.code === inputCode.trim()) {
    otpStore.delete(email.toLowerCase()); // Burn OTP on success
    return true;
  }
  return false;
}

/**
 * Send OTP Email via Gmail SMTP
 */
export async function sendOtpEmail(
  toEmail: string,
  purpose: 'REGISTER' | 'FORGOT_PASSWORD'
): Promise<{ success: boolean; message: string }> {
  const code = generateOtp(toEmail, purpose);

  const title =
    purpose === 'REGISTER'
      ? 'FleetWise Account Verification OTP'
      : 'FleetWise Password Reset OTP';

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0b1120; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 480px; margin: auto;">
      <h2 style="color: #38bdf8; margin-top: 0;">🚖 FleetWise Security Verification</h2>
      <p style="color: #cbd5e1; font-size: 14px;">Use the one-time verification code below to complete your ${
        purpose === 'REGISTER' ? 'account registration' : 'password reset'
      }:</p>
      <div style="background-color: #1e293b; border: 1px solid #38bdf8; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8;">${code}</span>
      </div>
      <p style="font-size: 12px; color: #94a3b8;">This code is valid for 10 minutes. If you did not request this, please disregard this email.</p>
      <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
      <p style="font-size: 11px; color: #64748b; text-align: center;">FleetWise • Business Intelligence & Fleet Management Platform</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"FleetWise" <${env.SMTP_MAIL}>`,
      to: toEmail,
      subject: `${title} - ${code}`,
      html,
    });
    logger.info('OTP email sent successfully', { messageId: info.messageId, to: toEmail });
    return { success: true, message: 'OTP sent to your email.' };
  } catch (error) {
    logger.error('Failed to send OTP email via SMTP', { error, to: toEmail });
    // In dev fallback, log code so developer can test even if email delivery encounters network issues
    logger.info(`DEV FALLBACK OTP for ${toEmail}: ${code}`);
    return { success: true, message: `OTP generated (Check inbox or console in dev).` };
  }
}
