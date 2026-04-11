import { Request, Response } from "express";
import { IUseCase } from "../interface";
import { PagingDTOSchema } from "../model/paging";
export abstract class BaseHttpService<Entity, CreateDTO, UpdateDTO, Cond> {
  constructor(readonly useCase: IUseCase<CreateDTO, UpdateDTO, Entity, Cond>) {}

  async createAPI(req: Request<any, any, CreateDTO>, res: Response) {
    const result = await this.useCase.create(req.body);
    res.status(201).json({ data: result });
  }

  async getDetailAPI(req: Request, res: Response) {
    const id = req.params.id as string;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const result = await this.useCase.getDetail(String(id));
    res.status(200).json({ data: result });
  }

  async updateAPI(req: Request<any, any, UpdateDTO>, res: Response) {
    const id = req.params.id as string;
    if (!id || id === "profile" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const result = await this.useCase.update(String(id), req.body);
    res.status(200).json({ data: result });
  }

  async deleteAPI(req: Request, res: Response) {
    const id = req.params.id as string;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    await this.useCase.delete(String(id));
    res.status(204).send();
  }

  async listAPI(req: Request, res: Response) {
    const {
      success,
      data: paging,
      error,
    } = PagingDTOSchema.safeParse(req.query);

    if (!success) {
      res.status(422).json({
        error: "Validation error",
        details: error.message,
      });

      return;
    }

    const result = await this.useCase.list(req.query as Cond, paging);
    res.status(200).json({
      data: result,
      page: paging.page,
      limit: paging.limit,
      filter: req.query as Cond,
    });
  }
}
