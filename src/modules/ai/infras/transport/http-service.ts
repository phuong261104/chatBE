import { Router, Request, Response } from "express";
import { z } from "zod";
import { uuidV7, uuidV4 } from "@share/utils/zod-validators";
import { AiUseCaseFacade } from "@modules/ai/usecase";
import { ToneType } from "@modules/ai/model/dto";

const ToneTypeSchema = z.enum(["formal", "casual", "funny", "professional"]);

const SummarizeSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  maxMessages: z.number().optional(),
});

const SmartReplySchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV4().optional(),
});

const ToneAdjustSchema = z.object({
  message: z.string().min(1).max(5000),
  tone: ToneTypeSchema,
});

const TranslateSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLang: z.string().min(1).max(50),
  sourceLang: z.string().optional(),
});

const DetectLanguageSchema = z.object({
  text: z.string().min(1).max(5000),
});

export class AiHttpService {
  private _router: Router;

  constructor(private aiFacade: AiUseCaseFacade) {
    this._router = Router();
    this.registerRoutes();
  }

  get router() {
    return this._router;
  }

  private registerRoutes() {
    this._router.post("/summarize", this.summarize.bind(this));
    this._router.post("/smart-reply", this.smartReply.bind(this));
    this._router.post("/tone-adjust", this.toneAdjust.bind(this));
    this._router.post("/translate", this.translate.bind(this));
    this._router.post("/detect-language", this.detectLanguage.bind(this));
  }

  async summarize(req: Request, res: Response) {
    try {
      const parsed = SummarizeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.summarize(parsed.data);
      return res.json(result);
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  async smartReply(req: Request, res: Response) {
    try {
      const parsed = SmartReplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const requester = res.locals["requester"];
      const userId = parsed.data.userId || requester?.sub;

      const result = await this.aiFacade.getSmartReplies({
        conversationId: parsed.data.conversationId,
        userId,
      });
      return res.json(result);
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  async toneAdjust(req: Request, res: Response) {
    try {
      const parsed = ToneAdjustSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.adjustTone(parsed.data);
      return res.json(result);
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  async translate(req: Request, res: Response) {
    try {
      const parsed = TranslateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.translate(parsed.data);
      return res.json(result);
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  async detectLanguage(req: Request, res: Response) {
    try {
      const parsed = DetectLanguageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const language = await this.aiFacade.detectLanguage(parsed.data);
      return res.json({ language });
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}
