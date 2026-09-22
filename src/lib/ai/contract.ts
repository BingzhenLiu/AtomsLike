import { z } from "zod";
import { MAX_HTML_LENGTH } from "@/lib/preview/validate-html";

export const generateRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4_000),
  currentHtml: z.string().max(MAX_HTML_LENGTH).optional(),
  plan: z
    .object({
      goal: z.string().trim().min(1).max(300),
      coreFeatures: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
      nonGoals: z.array(z.string().trim().min(1).max(200)).max(8),
      assumptions: z.array(z.string().trim().min(1).max(200)).max(8),
      openQuestions: z.array(z.string().trim().min(1).max(200)).max(8),
    })
    .optional(),
});

export const planRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4_000),
  feedback: z.string().trim().max(1_000).optional(),
  revision: z.number().int().min(1).max(20).optional(),
});

export const planResponseSchema = z.object({
  goal: z.string().trim().min(1).max(300),
  coreFeatures: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  nonGoals: z.array(z.string().trim().min(1).max(200)).max(8),
  assumptions: z.array(z.string().trim().min(1).max(200)).max(8),
  openQuestions: z.array(z.string().trim().min(1).max(200)).max(8),
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
export type PlanRequest = z.infer<typeof planRequestSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
