import { Request, Response } from "express";
import { z } from "zod";
import { ISearchUseCase } from "../../interface";
import { globalSearchDTOSchema } from "../../model";

export class SearchHTTPService {
  constructor(private readonly useCase: ISearchUseCase) {}

  async globalSearchAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester?.sub;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = globalSearchDTOSchema.parse({
        query: String(req.query.query ?? req.query.q ?? ""),
        type: req.query.type,
        conversationId: req.query.conversationId,
        mediaType: req.query.mediaType,
        from: req.query.from,
        to: req.query.to,
        senderId: req.query.senderId,
        cursor: req.query.cursor,
        limit: req.query.limit,
        contextLimit: req.query.contextLimit,
      });

      const result = await this.useCase.globalSearch(userId, validatedData);

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = typeof err.getStatusCode === "function"
        ? err.getStatusCode()
        : err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }
}
