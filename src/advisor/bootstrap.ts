import { ConversationCache } from "./cache/conversation-cache.js";
import { checkLoanAgreement } from "./capabilities/document-capability.js";
import {
  breakdownLastQueryByProvince,
  rewindQuery,
  searchPortfolio,
} from "./capabilities/portfolio-capability.js";
import { lookupDefinition } from "./capabilities/definition-capability.js";
import { DeterministicEmbeddingProvider } from "./providers/embedding-provider.js";
import { MockLlmProvider } from "./providers/mock-llm-provider.js";
import { OpenAiEmbeddingProvider } from "./providers/openai-embedding-provider.js";
import { OpenAiLlmProvider } from "./providers/openai-llm-provider.js";
import { ConversationRepository } from "./repositories/conversation.repository.js";
import { DocumentRepository } from "./repositories/document.repository.js";
import { PortfolioRepository } from "./repositories/portfolio.repository.js";
import { AdvisorService } from "./service/advisor-service.js";
import { env } from "../config/env.js";
import { getRedisClient } from "../infrastructure/redis.js";

const createAdvisorService = async () => {
  const redisClient = await getRedisClient().catch(() => null);

  const conversationRepository = new ConversationRepository();
  const portfolioRepository = new PortfolioRepository();
  const documentRepository = new DocumentRepository();
  const cache = new ConversationCache(redisClient);
  const llmProvider =
    env.ADVISOR_LLM_PROVIDER === "openai"
      ? new OpenAiLlmProvider()
      : new MockLlmProvider();
  const embeddingProvider =
    env.ADVISOR_LLM_PROVIDER === "openai"
      ? new OpenAiEmbeddingProvider()
      : new DeterministicEmbeddingProvider();

  return new AdvisorService(
    conversationRepository,
    portfolioRepository,
    documentRepository,
    cache,
    llmProvider,
    embeddingProvider,
    {
      checkLoanAgreement,
      breakdownLastQueryByProvince,
      lookupDefinition,
      rewindQuery,
      searchPortfolio,
    },
  );
};

export { createAdvisorService };
