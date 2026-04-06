import { IEmailProvider } from "./nodemailer";
import { config } from "@share/component/config";

const VERIFICATION_TEMPLATE = (code: string, displayName?: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Email Verification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #4A90E2;">Email Verification</h2>
    <p>Hello ${displayName || "there"},</p>
    <p>Your verification code is:</p>
    <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; margin: 20px 0;">
      <strong>${code}</strong>
    </div>
    <p>This code will expire in <strong>5 minutes</strong>.</p>
    <p>If you didn't request this code, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">
      This is an automated email from ${config.email.fromName}.
    </p>
  </div>
</body>
</html>
`;

const PASSWORD_RESET_OTP_TEMPLATE = (otp: string, displayName?: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #E74C3C;">Password Reset Request</h2>
    <p>Hello ${displayName || "there"},</p>
    <p>We received a request to reset your password.</p>
    <p>Your verification code:</p>
    <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; margin: 20px 0;">
      <strong>${otp}</strong>
    </div>
    <p>This code will expire in <strong>5 minutes</strong>.</p>
    <p>If you didn't request a password reset, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">
      This is an automated email from ${config.email.fromName}.
    </p>
  </div>
</body>
</html>
`;

const RESET_PASSWORD_TEMPLATE = (resetLink: string, displayName?: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #E74C3C;">Password Reset Request</h2>
    <p>Hello ${displayName || "there"},</p>
    <p>We received a request to reset your password.</p>
    <div style="margin: 30px 0;">
      <a href="${resetLink}" style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Reset Password
      </a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>
    <p>This link will expire in <strong>1 hour</strong>.</p>
    <p>If you didn't request a password reset, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">
      This is an automated email from ${config.email.fromName}.
    </p>
  </div>
</body>
</html>
`;

const WELCOME_TEMPLATE = (displayName: string, email: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #4A90E2;">Welcome to ${config.email.fromName}!</h2>
    <p>Hello <strong>${displayName}</strong>,</p>
    <p>Thank you for registering with us.</p>
    <p>Your account email: <strong>${email}</strong></p>
    <p>You can now login and start using our services.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">
      This is an automated email from ${config.email.fromName}.
    </p>
  </div>
</body>
</html>
`;

export class EmailTemplateService {
  constructor(private readonly emailProvider: IEmailProvider) {}

  async sendVerificationEmail(to: string, code: string, displayName?: string): Promise<void> {
    await this.emailProvider.sendEmail({
      to,
      subject: `${config.email.fromName} - Email Verification Code`,
      html: VERIFICATION_TEMPLATE(code, displayName),
      text: `Your verification code is: ${code}. This code will expire in 5 minutes.`,
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string, displayName?: string): Promise<void> {
    await this.emailProvider.sendEmail({
      to,
      subject: `${config.email.fromName} - Password Reset Request`,
      html: RESET_PASSWORD_TEMPLATE(resetLink, displayName),
      text: `You requested a password reset. Click this link to reset your password: ${resetLink}. This link will expire in 1 hour.`,
    });
  }

  async sendPasswordResetOTPEmail(to: string, otp: string, displayName?: string): Promise<void> {
    await this.emailProvider.sendEmail({
      to,
      subject: `${config.email.fromName} - Password Reset Verification Code`,
      html: PASSWORD_RESET_OTP_TEMPLATE(otp, displayName),
      text: `Your password reset verification code is: ${otp}. This code will expire in 5 minutes.`,
    });
  }

  async sendWelcomeEmail(to: string, displayName: string): Promise<void> {
    await this.emailProvider.sendEmail({
      to,
      subject: `Welcome to ${config.email.fromName}!`,
      html: WELCOME_TEMPLATE(displayName, to),
    });
  }
}
