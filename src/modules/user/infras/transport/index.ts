import { IPresenceUseCase, IUserUseCase } from "@modules/user/interface";
import { UserRole, Requester } from "@share/interface";
import { BaseHttpService } from "@share/transport/http-server";
import { Request, Response } from "express";
import { User } from "../../model/model";
import { UserCondDTO, UserUpdateDTO, UpdateProfileDTO } from "../../model/dto";
import { AppError } from "@share/app-error";

export class UserHTTPService extends BaseHttpService<
  User,
  any,
  UserUpdateDTO,
  UserCondDTO
> {
  constructor(
    readonly usecase: IUserUseCase,
    private readonly presenceUseCase: IPresenceUseCase,
  ) {
    super(usecase);
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
      const requester = res.locals["requester"] as Requester;
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
    try {
      const requester = res.locals["requester"] as Requester;
      const dto = req.body as UpdateProfileDTO;

      await this.usecase.updateProfile(requester, dto);

      res.status(200).json({ data: true });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }

  async publicProfileAPI(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const publicProfile = await this.usecase.getPublicProfile(id);

      res.status(200).json({ data: publicProfile });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }

  async getPresenceAPI(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      if (!id) {
        res.status(422).json({
          message: "id is required",
        });
        return;
      }

      const presence = await this.presenceUseCase.getUserPresence(id as string);

      res.status(200).json({
        data: {
          userId: id,
          isOnline: presence.isOnline,
          lastSeen: presence.lastSeen,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }
}
