import { IAuthUseCase } from "../../interface";
import { jwtProvider } from "@share/component/jwt";
import { UserRole } from "@share/interface";
import { AppError } from "@share/app-error";
import { Request, Response } from "express";
import { RegistrationDTO } from "../../model/dto";

export class AuthHTTPService {
  constructor(private readonly usecase: IAuthUseCase) {}

  async registerAPI(req: Request, res: Response) {
    try {
      const userId = await this.usecase.register(req.body as RegistrationDTO);
      const token = await jwtProvider.generateToken({
        sub: userId,
        role: UserRole.USER,
      });

      res.status(201).json({
        data: {
          token,
          userId,
        },
      });
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
      const token = await this.usecase.login(req.body);
      res.status(200).json({ data: { token } });
    } catch (error) {
      if (error instanceof AppError && error.getStatusCode() === 400) {
        res.status(401).json({ message: error.message });
        return;
      }
      res.status(401).json({ message: (error as Error).message });
    }
  }

  async introspectAPI(req: Request, res: Response) {
    try {
      const { token } = req.body;
      const result = await this.usecase.introspect(token);
      if (!result) {
        res.status(400).json({ message: "Invalid token" });
        return;
      }
      res.status(200).json({ data: result });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }
}
