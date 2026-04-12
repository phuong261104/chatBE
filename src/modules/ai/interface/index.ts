export interface IAiProvider {
  generateContent(prompt: string, systemInstruction?: string): Promise<string>;
  generateStructuredContent<T>(prompt: string, systemInstruction?: string): Promise<T>;
}
