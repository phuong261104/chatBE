import { IUserUseCase } from "@modules/user/interface";
import { jwtProvider } from "@share/component/jwt";
import { UserRole } from "@share/interface";
import { BaseHttpService } from "@share/transport/http-server";
import { Request, Response } from "express";
import { User, UserRegistrationDTO } from "../../model/model";
import { UserCondDTO, UserUpdateDTO } from "../../model/dto";
import { AppError } from "@share/app-error";

export class UserHTTPService extends BaseHttpService<
  User,
  UserRegistrationDTO,
  UserUpdateDTO,
  UserCondDTO
> {
  constructor(readonly usecase: IUserUseCase) {
    super(usecase);
  }

  async registerAPI(req: Request, res: Response) {
    try {
      const userId = await this.usecase.register(req.body);
      const user = await this.usecase.getDetail(userId);
      const token = await jwtProvider.generateToken({
        sub: userId,
        role: UserRole.USER,
      });

      res.status(201).json({
        data: {
          token,
          user: {
            id: userId,
            email: (user as any).email,
            phone: (user as any).phone,
            username: (user as any).username,
            displayName: (user as any).displayName,
            avatarUrl: (user as any).avatarUrl,
          },
        },
      });
    } catch (error) {
      if (error instanceof AppError && error.getStatusCode() === 400) {
        res.status(422).json({
          message: error.message,
        });
        return;
      }

      res.status(422).json({
        message: (error as Error).message,
      });
    }
  }

  async loginAPI(req: Request, res: Response) {
    try {
      const token = await this.usecase.login(req.body);
      res.status(200).json({ data: { token } });
    } catch (error) {
      if (error instanceof AppError && error.getStatusCode() === 400) {
        res.status(401).json({
          message: error.message,
        });
        return;
      }

      res.status(401).json({
        message: (error as Error).message,
      });
    }
  }

  async searchByPhoneAPI(req: Request, res: Response) {
    try {
      const { phone } = req.query as { phone?: string };

      if (!phone) {
        res.status(422).json({
          message: "phone is required",
        });
        return;
      }

      const user = await this.usecase.searchByPhone(phone);
      if (!user) {
        res.status(404).json({
          message: "User not found",
        });
        return;
      }

      const { password, salt, ...otherProps } = user as User;
      res.status(200).json({ data: otherProps });
    } catch (error) {
      if (error instanceof AppError && error.getStatusCode() === 400) {
        res.status(422).json({
          message: error.message,
        });
        return;
      }

      res.status(422).json({
        message: (error as Error).message,
      });
    }
  }

  async profileAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const { sub } = requester;

      const user = await this.usecase.profile(sub);

      const { salt, password, ...otherProps } = user;
      res.status(200).json({ data: otherProps });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }

  async updateProfileAPI(req: Request, res: Response) {
    const requester = res.locals["requester"];
    const { sub } = requester;

    await this.usecase.updateProfile(requester, req.body);

    res.status(200).json({ data: true });
  }

  async introspectAPI(req: Request, res: Response) {
    try {
      const { token } = req.body;
      const result = await this.usecase.verifyToken(token);
      res.status(200).json({ data: result });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }
}
