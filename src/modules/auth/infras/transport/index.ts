import { IAuthUseCase, RegisterPendingResponse } from "../../usecase";
import { Requester, DeviceType, DeviceDetails, Platform, DeviceInfo } from "@share/interface";
import { AppError } from "@share/app-error";
import { config } from "@share/component/config";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { parseUserAgent } from "../device/device-parser";
import {
  LoginDTO,
  RegistrationDTO,
  RefreshTokenDTO,
  SendVerificationDTO,
  VerifyEmailDTO,
  ForgotPasswordDTO,
  VerifyResetOTPDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  RegistrationDTOSchema,
  UpdateAvatarDTOSchema,
} from "../../model/dto";

const VALID_DEVICE_TYPES: DeviceType[] = [
  "mobile-app", "mobile-web",
  "tablet-app", "tablet-web",
  "laptop-app", "laptop-web",
  "desktop-app", "desktop-web",
  "other",
];

export class AuthHTTPService {
  constructor(private readonly usecase: IAuthUseCase) {}

  private resolveDeviceType(headerType?: string, userAgent?: string): DeviceType {
    if (headerType && VALID_DEVICE_TYPES.includes(headerType as DeviceType)) {
      return headerType as DeviceType;
    }
    const ua = userAgent || "";
    const lowerUA = ua.toLowerCase();
    const mobilePattern = /android|iphone|ipod|blackberry|windows phone|mobile/i;
    const tabletPattern = /tablet|ipad|playbook|silk|kindle|nexus 7/i;
    const osPattern = /mac os|windows nt|linux|x11|ubuntu/i;
    const laptopPattern = /macbook|portable|laptop|notebook/i;

    let base: string;
    if (mobilePattern.test(lowerUA)) {
      base = "mobile";
    } else if (tabletPattern.test(lowerUA)) {
      base = "tablet";
    } else if (osPattern.test(lowerUA)) {
      base = laptopPattern.test(lowerUA) ? "laptop" : "desktop";
    } else {
      base = laptopPattern.test(lowerUA) ? "laptop" : "mobile";
    }

    const appPatterns = [
      /app\/[\d.]+\s*/i,
      /com\.\w+\.\w+/i,
      /\bwv\b/i,
      /webview/i,
      /;\s*wb\s*/i,
      /\[FBAN|FBIOS|FB4A\]/i,
      /MobileConfig/i,
    ];
    const platform: "app" | "web" = appPatterns.some((p) => p.test(lowerUA)) ? "app" : "web";
    return `${base}-${platform}` as DeviceType;
  }

  private extractDeviceInfo(req: Request): { deviceId: string; deviceType: DeviceType; userAgent: string; ip: string; location?: string; details?: DeviceDetails } | undefined {
    const deviceId = req.headers["x-device-id"] as string;
    const headerDeviceType = req.headers["x-device-type"] as string | undefined;
    const userAgent = req.headers["user-agent"] || "Unknown";
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const location = req.headers["x-device-location"] as string | undefined;
    const deviceType = this.resolveDeviceType(headerDeviceType, userAgent);

    const headerDisplayLabel = req.headers["x-display-label"] as string | undefined;
    const headerPlatform = req.headers["x-device-platform"] as Platform | undefined;
    let details: DeviceDetails | undefined;

    if (headerDisplayLabel && headerPlatform) {
      details = { displayLabel: headerDisplayLabel, platform: headerPlatform };
    } else {
      details = parseUserAgent(userAgent);
    }

    if (deviceId) {
      return { deviceId, deviceType, userAgent, ip, location, details };
    }
    return undefined;
  }

  async registerAPI(req: Request, res: Response) {
    try {
      const dto = RegistrationDTOSchema.parse(req.body);
      const requireVerification = dto.sendVerificationEmail;

      let deviceInfo: { deviceId: string; deviceType: DeviceType; userAgent: string; ip: string; location?: string; details?: DeviceDetails } | undefined;

      if (!requireVerification) {
        deviceInfo = this.extractDeviceInfo(req);
      }

      const result = await this.usecase.register(dto, deviceInfo);

      if ("pendingVerification" in result) {
        res.status(200).json({ data: result });
      } else {
        const deviceId = this.extractDeviceIdFromToken(result.refreshToken);
        res.setHeader("X-Device-Id", deviceId);
        res.setHeader("X-Device-Type", result.deviceType);
        if (result.displayLabel) res.setHeader("X-Display-Label", result.displayLabel);
        if (result.platform) res.setHeader("X-Device-Platform", result.platform);
        res.status(201).json({ data: result });
      }
    } catch (error) {
      if (error instanceof AppError && error.getStatusCode() === 400) {
        res.status(422).json({ message: error.message });
        return;
      }
      res.status(422).json({ message: (error as Error).message });
    }
  }

  async loginAPI(req: Request, res: Response) {
    try {
      const deviceInfo = this.extractDeviceInfo(req);
      const result = await this.usecase.login(req.body as LoginDTO, deviceInfo);
      const effectiveDeviceId = deviceInfo?.deviceId || (result.refreshToken ? this.extractDeviceIdFromToken(result.refreshToken) : "");
      if (effectiveDeviceId) {
        res.setHeader("X-Device-Id", effectiveDeviceId);
        res.setHeader("X-Device-Type", result.deviceType);
        if (result.displayLabel) res.setHeader("X-Display-Label", result.displayLabel);
        if (result.platform) res.setHeader("X-Device-Platform", result.platform);
      }
      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof AppError && error.getStatusCode() === 400) {
        res.status(401).json({ message: error.message });
        return;
      }
      res.status(401).json({ message: (error as Error).message });
    }
  }

  private extractDeviceIdFromToken(refreshToken: string): string {
    try {
      const payload = jwt.decode(refreshToken) as { deviceId?: string };
      return payload?.deviceId || "";
    } catch {
      return "";
    }
  }

  async refreshAPI(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body as RefreshTokenDTO;
      if (!refreshToken) {
        res.status(400).json({ message: "refreshToken is required" });
        return;
      }
      const result = await this.usecase.refreshToken(refreshToken);
      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof AppError && error.getStatusCode() === 401) {
        res.status(401).json({ message: error.message });
        return;
      }
      res.status(401).json({ message: (error as Error).message });
    }
  }

  async logoutAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester;
      const deviceId = req.headers["x-device-id"] as string;
      const token = req.headers.authorization?.split(" ")[1];
      await this.usecase.logout(requester, deviceId);
      if (token) {
        try {
          const jwtLib = await import("jsonwebtoken");
          const payload = jwtLib.default.verify(token, config.accessToken.secretKey) as any;
          if (payload?.jti) {
            const ttl = Math.max(0, (payload.exp || 0) - Math.floor(Date.now() / 1000));
            if (ttl > 0) await this.usecase.blacklistToken(payload.jti, payload.exp);
          }
        } catch {}
      }
      res.status(200).json({ data: true });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async logoutAllAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester;
      await this.usecase.logoutAll(requester);
      res.status(200).json({ data: true });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async introspectAPI(req: Request, res: Response) {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ message: "token is required" });
        return;
      }
      const result = await this.usecase.introspect(token);
      res.status(200).json({
        data: {
          active: result.isOk,
          payload: result.payload,
        },
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async sendVerificationAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester | undefined;
      const userId = requester?.sub;
      await this.usecase.sendVerificationEmail(req.body as SendVerificationDTO, userId);
      res.status(200).json({ message: "Verification code sent successfully" });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async verifyEmailAPI(req: Request, res: Response) {
    try {
      const result = await this.usecase.verifyEmail(req.body as VerifyEmailDTO);
      res.status(200).json({ data: { verified: result }, message: "Email verified successfully" });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async resendVerificationAPI(req: Request, res: Response) {
    try {
      await this.usecase.resendVerificationEmail(req.body as SendVerificationDTO);
      res.status(200).json({ message: "Verification code resent successfully" });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async forgotPasswordAPI(req: Request, res: Response) {
    try {
      await this.usecase.forgotPassword(req.body as ForgotPasswordDTO);
      res.status(200).json({ message: "Verification code has been sent to your email", expiresIn: 300 });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async verifyResetOTPAPI(req: Request, res: Response) {
    try {
      const result = await this.usecase.verifyResetOTP(req.body as VerifyResetOTPDTO);
      res.status(200).json({ data: result, message: "OTP verified successfully" });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async resendResetOTPAPI(req: Request, res: Response) {
    try {
      await this.usecase.resendResetOTP(req.body as ForgotPasswordDTO);
      res.status(200).json({ message: "Verification code has been resent to your email", expiresIn: 300 });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async resetPasswordAPI(req: Request, res: Response) {
    try {
      const result = await this.usecase.resetPassword(req.body as ResetPasswordDTO);
      res.status(200).json({ data: { success: result }, message: "Password has been reset successfully" });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async changePasswordAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester;
      const result = await this.usecase.changePassword(requester, req.body as ChangePasswordDTO);
      res.status(200).json({ data: { success: result }, message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async listSessionsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester;
      const currentDeviceId = (req.headers["x-device-id"] as string) || "";
      const sessions = await this.usecase.getSessions(requester.sub, currentDeviceId);
      res.status(200).json({ data: sessions });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async revokeSessionAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester;
      const deviceId = req.params.deviceId as string;
      const currentDeviceId = req.headers["x-device-id"] as string | undefined;
      if (currentDeviceId && currentDeviceId === deviceId) {
        res.status(400).json({ message: "Use /auth/logout to revoke the current session" });
        return;
      }
      const result = await this.usecase.revokeSession(requester.sub, deviceId);
      if (!result) {
        res.status(404).json({ message: "Session not found" });
        return;
      }
      res.status(200).json({ data: true });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async revokeAllSessionsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester;
      const currentDeviceId = req.headers["x-device-id"] as string | undefined;
      if (!currentDeviceId) {
        res.status(400).json({ message: "X-Device-Id is required to revoke other sessions" });
        return;
      }
      const revoked = await this.usecase.revokeOtherSessions(requester.sub, currentDeviceId);
      res.status(200).json({ data: { revoked } });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async updateAvatarAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester;
      const { avatarUrl } = UpdateAvatarDTOSchema.parse(req.body);
      const result = await this.usecase.updateAvatar(requester.sub, avatarUrl || "");
      res.status(200).json({ data: { success: result }, message: "Avatar updated successfully" });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.getStatusCode()).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: (error as Error).message });
    }
  }
}
