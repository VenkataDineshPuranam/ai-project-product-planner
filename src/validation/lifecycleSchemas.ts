import { z } from "zod";
import { entityBaseSchema } from "./schemas";

export const featureSchema = entityBaseSchema
  .extend({
    epicId: z.string().min(1),
    outcomeId: z.string().min(1),
    acceptanceCriteria: z.array(z.string()),
    dataDependencies: z.array(z.string()),
    modelDependencies: z.array(z.string()),
    evaluationCriteria: z.array(z.string()),
    securityImpact: z.string().optional(),
    governanceImpact: z.string().optional(),
    costExpectation: z.number().optional(),
    ownerId: z.string().min(1),
    releaseId: z.string().optional(),
    committed: z.boolean(),
  })
  .superRefine((feature, ctx) => {
    if (!feature.committed) return;
    if (feature.acceptanceCriteria.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["acceptanceCriteria"], message: "a committed feature requires acceptance criteria" });
    }
    if (feature.evaluationCriteria.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evaluationCriteria"], message: "a committed feature requires evaluation criteria" });
    }
    if (!feature.releaseId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["releaseId"], message: "a committed feature requires a release target" });
    }
    if (!feature.ownerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ownerId"], message: "a committed feature requires an owner" });
    }
    if (!feature.outcomeId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["outcomeId"], message: "a committed feature requires a linked outcome" });
    }
  });

export const evaluationMetricSchema = entityBaseSchema.extend({
  kind: z.enum(["accuracy", "groundedness", "relevance", "safety", "latency", "cost"]),
  threshold: z.number().optional(),
});

export const evaluationContractSchema = entityBaseSchema.extend({
  metricIds: z.array(z.string()).min(1, "an evaluation contract requires at least one metric"),
  gateId: z.string().optional(),
  goldenSetRef: z.string().min(1),
});

export const evaluationRunSchema = entityBaseSchema.extend({
  evaluationContractId: z.string().min(1),
  modelVersionId: z.string().optional(),
  promptVersionId: z.string().optional(),
  results: z.record(z.string(), z.number()),
  passed: z.boolean(),
});

export const approvalSchema = entityBaseSchema.extend({
  approverId: z.string().min(1),
  decision: z.enum(["approved", "rejected", "conditional"]),
});

export const deploymentGateSchema = entityBaseSchema.extend({
  gateName: z.string().min(1),
  passed: z.boolean(),
  evidenceIds: z.array(z.string()),
  approvalIds: z.array(z.string()),
});

export const riskSchema = entityBaseSchema.extend({
  category: z.string().min(1),
  aiRiskCategory: z.string().optional(),
  cause: z.string().min(1),
  event: z.string().min(1),
  consequence: z.string().min(1),
  likelihood: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  impact: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  exposure: z.number(),
  proximity: z.string(),
  velocity: z.string(),
  treatment: z.string(),
  residualRisk: z.number().optional(),
  trigger: z.string().optional(),
  contingency: z.string().optional(),
  linkedTaskIds: z.array(z.string()),
  reviewDate: z.string(),
});
