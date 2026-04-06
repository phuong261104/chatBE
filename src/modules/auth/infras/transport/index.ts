import { IAuthUseCase, RegisterPendingResponse } from "../../usecase";
import { Requester } from "@share/interface";
import { AppError } from "@share/app-error";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
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
} from "../../model/dto";

export class AuthHTTPService {
  constructor(private readonly usecase: IAuthUseCase) {}

  private extractDeviceInfo(req: Request): { deviceId: string; userAgent: string; ip: string } | undefined {
    const deviceId = req.headers["x-device-id"] as string;
    const userAgent = req.headers["user-agent"] || "Unknown";
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (deviceId) {
      return { deviceId, userAgent, ip };
    }
    return undefined;
  }

  async registerAPI(req: Request, res: Response) {
    try {
      const deviceInfo = this.extractDeviceInfo(req);
      const result = await this.usecase.register(req.body as RegistrationDTO, deviceInfo);

      if ("pendingVerification" in result) {
        res.status(200).json({ data: result });
      } else {
        const effectiveDeviceId = deviceInfo?.deviceId || this.extractDeviceIdFromToken(result.refreshToken);
        if (effectiveDeviceId) {
          res.setHeader("X-Device-Id", effectiveDeviceId);
        }
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
      await this.usecase.logout(requester, deviceId);
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
      res.status(200).json({ data: result });
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
      await this.usecase.revokeAllSessions(requester.sub);
      res.status(200).json({ data: true });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async updateAvatarAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"] as Requester;
      const { avatarUrl } = req.body;

      if (!avatarUrl) {
        res.status(400).json({ message: "avatarUrl is required" });
        return;
      }

      const result = await this.usecase.updateAvatar(requester.sub, avatarUrl);
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
