import type { ConversationState, PlannedAction } from "../types.js";

type PlanInput = {
  message: string;
  conversation: ConversationState;
};

interface LlmProvider {
  readonly name: string;
  plan(input: PlanInput): Promise<PlannedAction>;
}

export type { LlmProvider, PlanInput };
