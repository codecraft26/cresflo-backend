import type { AdvisorCapabilityResult, AdvisorRequestContext } from "../types.js";
import type { DocumentRepository } from "../repositories/document.repository.js";
import type { PortfolioRepository } from "../repositories/portfolio.repository.js";
import type { EmbeddingProvider } from "../providers/embedding-provider.js";
import type { LlmProvider } from "../providers/provider.js";

type DocumentCapabilityDependencies = {
  documentRepository: DocumentRepository;
  embeddingProvider: EmbeddingProvider;
  portfolioRepository: PortfolioRepository;
  llmProvider: LlmProvider;
};

const checkLoanAgreement = async (
  dependencies: DocumentCapabilityDependencies,
  context: AdvisorRequestContext,
  loanId: string | undefined,
  question: string,
): Promise<AdvisorCapabilityResult> => {
  if (!loanId) {
    const relevantChunks = await dependencies.documentRepository.findRelevantChunks(
      context,
      undefined,
      await dependencies.embeddingProvider.embed(question),
    );

    if (relevantChunks.length === 0) {
      return {
        answer: {
          summary: "No indexed organization documents were found for this request yet.",
          evidence: [],
          warnings: [
            "Upload organization-level or loan-level documents before asking document-based questions.",
          ],
          followUpSuggestions: ["Upload a policy, procedure, or agreement for this organization."],
        },
      };
    }

    const matchedDocumentIds = [
      ...new Set(relevantChunks.map((chunk) => chunk.document_id)),
    ];
    const documentPreviews = await dependencies.documentRepository.findDocumentPreviews(
      context,
      matchedDocumentIds,
    );
    const groundedAnswer = await dependencies.llmProvider.generateGroundedAnswer({
      question,
      documents: [
        ...documentPreviews,
        ...relevantChunks.map((chunk) => ({
          documentId: chunk.document_id,
          title: chunk.document_title,
          content: chunk.content,
        })),
      ],
    });

    return {
      answer: {
        summary: groundedAnswer,
        data: {
          matchingClauses: relevantChunks.map((chunk) => ({
            documentId: chunk.document_id,
            content: chunk.content,
            similarity: chunk.similarity,
          })),
        },
        evidence: relevantChunks.map((chunk) => ({
          type: "document" as const,
          id: chunk.id,
          label: chunk.document_title,
          detail: `${chunk.content} (similarity ${chunk.similarity.toFixed(2)})`,
        })),
        warnings: ["This answer is grounded in organization-scoped uploaded documents."],
        followUpSuggestions: [
          "Ask about a specific loan agreement if you want a narrower legal answer.",
        ],
      },
    };
  }

  const [loan] = await dependencies.portfolioRepository.findLoansByIds(context, [loanId]);
  const document = await dependencies.documentRepository.findLoanAgreement(
    context,
    loanId,
  );

  if (!loan || !document) {
    return {
      answer: {
        summary: "No trusted loan agreement was found for that loan within your tenant scope.",
        evidence: [],
        warnings: ["Document analysis is limited to indexed agreements already registered in the backend."],
        followUpSuggestions: [],
      },
    };
  }

  const relevantChunks = await dependencies.documentRepository.findRelevantChunks(
    context,
    loanId,
    await dependencies.embeddingProvider.embed(question),
  );

  return {
    answer: {
      summary: document.sixMonthExtensionAllowed
        ? `Yes, ${loan.borrowerName}'s agreement allows a six-month extension, subject to lender approval conditions.`
        : `No, ${loan.borrowerName}'s agreement does not allow a standard six-month extension in its current state.`,
      data: {
        loan: {
          id: loan.id,
          borrowerName: loan.borrowerName,
        },
        document: {
          id: document.id,
          type: document.type,
          sixMonthExtensionAllowed: document.sixMonthExtensionAllowed,
          summary: document.summary,
        },
      },
      evidence: [
        {
          type: "document",
          id: document.id,
          label: `${document.type} for ${loan.id}`,
          detail: document.summary,
        },
        ...relevantChunks.map((chunk: { id: string; document_id: string; content: string; similarity: number }) => ({
          type: "document" as const,
          id: chunk.id,
          label: `Retrieved clause from ${chunk.document_id}`,
          detail: `${chunk.content} (similarity ${chunk.similarity.toFixed(2)})`,
        })),
      ],
      warnings: [
        "This answer is grounded in the indexed agreement summary. Final legal review should use the source document.",
      ],
      followUpSuggestions: ["Should we offer a renewal on this loan?"],
    },
  };
};

export { checkLoanAgreement };
export type { DocumentCapabilityDependencies };
