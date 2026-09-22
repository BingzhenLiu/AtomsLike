import { z } from "zod";
import { MAX_HTML_LENGTH } from "@/lib/preview/validate-html";

export const generateRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4_000),
  currentHtml: z.string().max(MAX_HTML_LENGTH).optional(),
  projectName: z.string().trim().max(80).optional(),
});

export const generateResponseSchema = z.object({
  projectName: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(500),
  html: z.string().min(1).max(MAX_HTML_LENGTH),
  mode: z.enum(["live", "demo"]),
});

export const modelOutputSchema = generateResponseSchema.omit({ mode: true });

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateResponse = z.infer<typeof generateResponseSchema>;
