import { z } from "zod";

import { HttpError } from "../errors.js";
import type { PlannedAction, Province, QueryConstraint } from "../types.js";
import { env } from "../../config/env.js";
import { createOpenAiClient } from "./openai-client.js";
import type { LlmProvider, PlanInput } from "./provider.js";

const provinceEnum = z.enum([
  "Ontario",
  "Quebec",
  "Alberta",
  "British Columbia",
]);

const queryConstraintSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("status"),
    operator: z.literal("eq"),
    value: z.enum(["current", "overdue", "defaulted"]),
  }),
  z.object({
    field: z.literal("principalOutstanding"),
    operator: z.literal("gt"),
    value: z.number(),
  }),
  z.object({
    field: z.literal("province"),
    operator: z.literal("in"),
    value: z.array(provinceEnum),
  }),
]);

const plannedActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("portfolio-search"),
    filters: z.array(queryConstraintSchema),
    label: z.string(),
  }),
  z.object({
    kind: z.literal("portfolio-breakdown"),
    dimension: z.literal("province"),
    source: z.literal("last-query"),
  }),
  z.object({
    kind: z.literal("query-rewind"),
    steps: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("definition-lookup"),
    concept: z.enum(["overdue", "high risk"]),
  }),
  z.object({
    kind: z.literal("document-check"),
    loanId: z.string().optional(),
    question: z.string(),
  }),
  z.object({
    kind: z.literal("missing-capability"),
    capability: z.string(),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("clarification"),
    question: z.string(),
  }),
]);

const buildSystemPrompt = () => `
You are the Cresflo AI Advisor planner.
Convert the user request into one planner action in strict JSON.

You must choose one of these actions:
- portfolio-search
- portfolio-breakdown
- query-rewind
- definition-lookup
- document-check
- missing-capability
- clarification

Rules:
- Return valid JSON only.
- Do not include markdown fences.
- Use portfolio-search for loan list/filter queries.
- Use portfolio-breakdown for follow-up grouping on the last result set.
- Use query-rewind when the user asks to remove the last condition or restore an earlier list.
- Use definition-lookup for lender-specific concepts like overdue or high risk.
- Use document-check for loan agreement and extension questions.
- Use missing-capability when the user asks for unsupported analysis like stress testing.
- Use clarification if the request is ambiguous.
`;

const formatConversationContext = (input: PlanInput) => {
  const lastMessages = input.conversation.messages.slice(-6).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const lastQuery = input.conversation.queryHistory[input.conversation.queryHistory.length - 1];

  return JSON.stringify(
    {
      userMessage: input.message,
      conversationMessages: lastMessages,
      lastQuerySnapshot: lastQuery ?? null,
      supportedProvinces: provinceEnum.options,
      supportedConstraints: [
        {
          field: "status",
          operator: "eq",
          values: ["current", "overdue", "defaulted"],
        },
        {
          field: "principalOutstanding",
          operator: "gt",
          valueType: "number",
        },
        {
          field: "province",
          operator: "in",
          values: provinceEnum.options,
        },
      ],
    },
    null,
    2,
  );
};

class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai-responses-provider";

  async plan(input: PlanInput): Promise<PlannedAction> {
    if (!env.OPENAI_API_KEY) {
      throw new HttpError(500, "OPENAI_API_KEY is required for OpenAI planning.");
    }

    const client = createOpenAiClient();
    const response = await client.responses.create({
      model: env.OPENAI_LLM_MODEL,
      instructions: buildSystemPrompt(),
      input: formatConversationContext(input),
    });

    const outputText = response.output_text?.trim();

    if (!outputText) {
      throw new HttpError(502, "OpenAI response did not return planner output.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new HttpError(502, "OpenAI planner returned invalid JSON.");
    }

    const action = plannedActionSchema.parse(parsed);

    return this.normalizeAction(action);
  }

  private normalizeAction(action: z.infer<typeof plannedActionSchema>): PlannedAction {
    if (action.kind !== "portfolio-search") {
      return action;
    }

    const normalizedFilters: QueryConstraint[] = action.filters.map((filter) => {
      if (filter.field === "province") {
        return {
          field: "province",
          operator: "in",
          value: filter.value as Province[],
        };
      }

      return filter;
    });

    return {
      kind: "portfolio-search",
      filters: normalizedFilters,
      label: action.label,
    };
  }
}

export { OpenAiLlmProvider };
