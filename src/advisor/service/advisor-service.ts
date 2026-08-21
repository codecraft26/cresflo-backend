import type { ConversationCache } from "../cache/conversation-cache.js";
import type { DefinitionCapabilityDependencies } from "../capabilities/definition-capability.js";
import type { DocumentCapabilityDependencies } from "../capabilities/document-capability.js";
import type { PortfolioCapabilityDependencies } from "../capabilities/portfolio-capability.js";
import type { EmbeddingProvider } from "../providers/embedding-provider.js";
import type { LlmProvider } from "../providers/provider.js";
import type { ConversationRepository } from "../repositories/conversation.repository.js";
import type { DocumentRepository } from "../repositories/document.repository.js";
import type { PortfolioRepository } from "../repositories/portfolio.repository.js";
import type {
  AdvisorAnswer,
  AdvisorRequestContext,
  ConversationState,
  QuerySnapshot,
} from "../types.js";
import { formatAdvisorAnswerAsMarkdown } from "../utils/format-answer-markdown.js";

type CapabilitySet = {
  searchPortfolio: (
    dependencies: PortfolioCapabilityDependencies,
    context: AdvisorRequestContext,
    filters: QuerySnapshot["constraints"],
    label: string,
  ) => Promise<{ answer: AdvisorAnswer; nextQuerySnapshot?: QuerySnapshot }>;
  breakdownLastQueryByProvince: (
    dependencies: PortfolioCapabilityDependencies,
    context: AdvisorRequestContext,
    snapshot: QuerySnapshot | undefined,
  ) => Promise<{ answer: AdvisorAnswer; nextQuerySnapshot?: QuerySnapshot }>;
  rewindQuery: (
    dependencies: PortfolioCapabilityDependencies,
    context: AdvisorRequestContext,
    snapshots: QuerySnapshot[],
    steps: number,
  ) => Promise<{ answer: AdvisorAnswer; nextQuerySnapshot?: QuerySnapshot }>;
  lookupDefinition: (
    dependencies: DefinitionCapabilityDependencies,
    context: AdvisorRequestContext,
    concept: "overdue" | "high risk",
  ) => Promise<{ answer: AdvisorAnswer }>;
  checkLoanAgreement: (
    dependencies: DocumentCapabilityDependencies,
    context: AdvisorRequestContext,
    loanId: string | undefined,
    question: string,
  ) => Promise<{ answer: AdvisorAnswer }>;
};

type AdvisorStreamHooks = {
  onPlanningStarted?: () => Promise<void> | void;
  onPlanReady?: (plan: { kind: string }) => Promise<void> | void;
  onAnswerReady?: (answer: AdvisorAnswer, message: string) => Promise<void> | void;
  onConversationUpdated?: (conversation: ConversationState) => Promise<void> | void;
};

class AdvisorService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly portfolioRepository: PortfolioRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly cache: ConversationCache,
    private readonly provider: LlmProvider,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly capabilities: CapabilitySet,
  ) {}

  async createConversation(context: AdvisorRequestContext) {
    const conversation = await this.conversations.create(context);
    await this.cache.set(conversation);
    return conversation;
  }

  async listConversations(context: AdvisorRequestContext) {
    return this.conversations.listByContext(context);
  }

  async getConversation(id: string) {
    return this.loadConversation(id, true);
  }

  private async loadConversation(id: string, useCache: boolean) {
    const cached = await this.cache.get(id);

    if (useCache && cached) {
      return cached;
    }

    const conversation = await this.conversations.findById(id);

    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    await this.cache.set(conversation);

    return conversation;
  }

  async handleMessage(conversationId: string, message: string) {
    return this.handleMessageWithHooks(conversationId, message);
  }

  async handleMessageWithHooks(
    conversationId: string,
    message: string,
    hooks?: AdvisorStreamHooks,
  ) {
    const conversation = await this.loadConversation(conversationId, true);

    await this.conversations.appendMessage(conversationId, "user", message);
    await hooks?.onPlanningStarted?.();

    const plan = await this.provider.plan({
      message,
      conversation,
    });
    await hooks?.onPlanReady?.(plan);

    let answer: AdvisorAnswer | null = null;
    let snapshot = undefined;

    switch (plan.kind) {
      case "portfolio-search": {
        const result = await this.capabilities.searchPortfolio(
          {
            portfolioRepository: this.portfolioRepository,
          },
          conversation.context,
          plan.filters,
          plan.label,
        );
        answer = result.answer;
        snapshot = result.nextQuerySnapshot;
        break;
      }
      case "portfolio-breakdown": {
        const result = await this.capabilities.breakdownLastQueryByProvince(
          {
            portfolioRepository: this.portfolioRepository,
          },
          conversation.context,
          conversation.queryHistory[conversation.queryHistory.length - 1],
        );
        answer = result.answer;
        snapshot = result.nextQuerySnapshot;
        break;
      }
      case "query-rewind": {
        const result = await this.capabilities.rewindQuery(
          {
            portfolioRepository: this.portfolioRepository,
          },
          conversation.context,
          conversation.queryHistory,
          plan.steps,
        );
        answer = result.answer;
        snapshot = result.nextQuerySnapshot;
        break;
      }
      case "definition-lookup": {
        answer = (
          await this.capabilities.lookupDefinition(
            {
              portfolioRepository: this.portfolioRepository,
            },
            conversation.context,
            plan.concept,
          )
        ).answer;
        break;
      }
      case "document-check": {
        answer = (
          await this.capabilities.checkLoanAgreement(
            {
              documentRepository: this.documentRepository,
              embeddingProvider: this.embeddingProvider,
              portfolioRepository: this.portfolioRepository,
              llmProvider: this.provider,
            },
            conversation.context,
            plan.loanId,
            plan.question,
          )
        ).answer;
        break;
      }
      case "missing-capability": {
        answer = {
          summary: `I understand the request, but Cresflo does not yet have a trusted backend capability for ${plan.capability}.`,
          data: {
            requestedCapability: plan.capability,
          },
          evidence: [
            {
              type: "system",
              id: "missing-capability",
              label: "Capability gap detected",
              detail: plan.reason,
            },
          ],
          warnings: [
            "The advisor will not invent calculations or perform unsupported financial analysis.",
          ],
          followUpSuggestions: [
            "Would you like me to describe the backend capability needed to support this safely?",
          ],
        };
        break;
      }
      case "clarification": {
        answer = {
          summary: plan.question,
          evidence: [],
          warnings: ["The request is ambiguous, so I paused before running any capability."],
          followUpSuggestions: [
            "Show me all defaulted loans with principal above $50,000.",
            "How many loans are overdue?",
          ],
        };
        break;
      }
    }

    if (!answer) {
      throw new Error("Advisor did not produce an answer.");
    }

    const assistantMessage = formatAdvisorAnswerAsMarkdown(answer);

    await this.conversations.appendMessage(conversationId, "assistant", assistantMessage);

    if (snapshot) {
      await this.conversations.appendQuerySnapshot(conversationId, snapshot);
    }

    const updatedConversation = await this.loadConversation(conversationId, false);
    await this.cache.set(updatedConversation);
    await hooks?.onAnswerReady?.(answer, assistantMessage);
    await hooks?.onConversationUpdated?.(updatedConversation);

    return {
      plan,
      answer,
      message: assistantMessage,
      conversation: updatedConversation,
      provider: this.provider.name,
    };
  }
}

export type { ConversationState };
export { AdvisorService };
