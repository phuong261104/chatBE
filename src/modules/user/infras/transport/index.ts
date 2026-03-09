import { IUserUseCase } from "@modules/user/interface";
import { jwtProvider } from "@share/component/jwt";
import { BaseHttpService } from "@share/transport/http-server";
import { Request, Response } from "express";
import { User, UserRegistrationDTO } from "../../model/model";
import { UserCondDTO, UserUpdateDTO } from "../../model/dto";
import { successResponse } from "@share/utils/util";

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
      const userId = await this.usecase.create(req.body);
      const user = await this.usecase.getDetail(userId);

      // Generate token for the newly registered user
      const token = await jwtProvider.generateToken({
        sub: userId,
        role: (user as any).role || "USER",
      });

      res.status(201).json({
        data: {
          token,
          user: {
            id: userId,
            email: (user as any).email,
            username: (user as any).username,
            fullName: (user as any).fullName,
          },
        },
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message,
      });
    }
  }

  async loginAPI(req: Request, res: Response) {
    const token = await this.usecase.login(req.body);
    res.status(200).json({ data: token });
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

    successResponse(true, res);
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
