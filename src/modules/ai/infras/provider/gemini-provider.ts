import { GoogleGenerativeAI, GenerateContentResult } from "@google/generative-ai";
import { config } from "@share/component/config";
import { AiError } from "../../model/errors";
import { IAiProvider } from "./interface";

export class GeminiProvider implements IAiProvider {
  private client: GoogleGenerativeAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      throw new AiError("AI_PROVIDER_ERROR", "GEMINI_API_KEY is not configured", 500);
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = config.gemini.model;
    this.maxTokens = config.gemini.maxTokens;
    this.temperature = config.gemini.temperature;
  }

  async generateContent(prompt: string, systemInstruction?: string): Promise<string> {
    return this.executeWithRetry(async () => {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: this.temperature,
        },
      });

      const result: GenerateContentResult = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new AiError("AI_INVALID_RESPONSE", "Gemini returned empty response", 500);
      }

      return text;
    });
  }

  async generateStructuredContent<T>(prompt: string, systemInstruction?: string): Promise<T> {
    const text = await this.generateContent(prompt, systemInstruction);
    try {
      const cleaned = this.extractJsonFromResponse(text);
      return JSON.parse(cleaned) as T;
    } catch {
      throw new AiError("AI_INVALID_RESPONSE", "Failed to parse Gemini response as JSON", 500);
    }
  }

  private extractJsonFromResponse(text: string): string {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
    return jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, attempt = 1, maxAttempts = 3): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      const isRateLimit = err?.status === 429 || err?.message?.includes("rate limit");
      const isServerError = (err?.status ?? 0) >= 500;

      if ((isRateLimit || isServerError) && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        await this.sleep(delay);
        return this.executeWithRetry(fn, attempt + 1, maxAttempts);
      }

      if (isRateLimit) {
        throw new AiError("AI_RATE_LIMIT", "Gemini API rate limit exceeded", 429);
      }

      throw new AiError("AI_PROVIDER_ERROR", err?.message || "Gemini API error", 500);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

let providerInstance: GeminiProvider | null = null;

export function getGeminiProvider(): GeminiProvider {
  if (!providerInstance) {
    providerInstance = new GeminiProvider();
  }
  return providerInstance;
}
