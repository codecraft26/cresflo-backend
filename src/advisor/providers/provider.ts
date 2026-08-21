import type { ConversationState, PlannedAction } from "../types.js";

type PlanInput = {
  message: string;
  conversation: ConversationState;
};

type GroundedDocumentContext = {
  documentId: string;
  title: string;
  content: string;
};

type GroundedAnswerInput = {
  question: string;
  documents: GroundedDocumentContext[];
};

interface LlmProvider {
  readonly name: string;
  plan(input: PlanInput): Promise<PlannedAction>;
  generateGroundedAnswer(input: GroundedAnswerInput): Promise<string>;
}

export type {
  GroundedAnswerInput,
  GroundedDocumentContext,
  LlmProvider,
  PlanInput,
};
