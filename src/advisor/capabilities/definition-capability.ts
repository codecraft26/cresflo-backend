import type {
  AdvisorCapabilityResult,
  AdvisorRequestContext,
  LoanRecord,
} from "../types.js";
import type { PortfolioRepository } from "../repositories/portfolio.repository.js";

type DefinitionCapabilityDependencies = {
  portfolioRepository: PortfolioRepository;
};

const lookupDefinition = async (
  dependencies: DefinitionCapabilityDependencies,
  context: AdvisorRequestContext,
  concept: "overdue" | "high risk",
): Promise<AdvisorCapabilityResult> => {
  const definition = await dependencies.portfolioRepository.getLenderDefinition(context);

  if (!definition) {
    return {
      answer: {
        summary: "No lender-specific definition is configured yet for this tenant and lender.",
        evidence: [],
        warnings: [
          "The advisor will not guess organization-specific thresholds when no trusted definition is stored.",
        ],
        followUpSuggestions: [
          "Load lender definitions into the backend configuration tables first.",
        ],
      },
    };
  }

  const tenantLoans: LoanRecord[] = await dependencies.portfolioRepository.searchLoans(
    context,
    [],
  );

  if (concept === "overdue") {
    const matchingLoans = tenantLoans.filter(
      (loan: LoanRecord) => loan.daysPastDue >= definition.overdueDaysThreshold,
    );

    return {
      answer: {
        summary: `${matchingLoans.length} loans are overdue using this lender's ${definition.overdueDaysThreshold}-day threshold.`,
        data: {
          definition: {
            concept: "overdue",
            thresholdDays: definition.overdueDaysThreshold,
          },
          loans: matchingLoans.map((loan: LoanRecord) => ({
            id: loan.id,
            borrowerName: loan.borrowerName,
            daysPastDue: loan.daysPastDue,
            status: loan.status,
          })),
        },
        evidence: [
          {
            type: "definition",
            id: `overdue-${context.lenderId}`,
            label: "Lender-specific definition",
            detail: `Overdue is defined for this lender as ${definition.overdueDaysThreshold}+ days past due.`,
          },
        ],
        warnings: [],
        followUpSuggestions: ["Which of these overdue loans are high risk?"],
      },
    };
  }

  const matchingLoans = tenantLoans.filter(
    (loan: LoanRecord) => loan.riskScore >= definition.highRiskScoreThreshold,
  );

  return {
    answer: {
      summary: `${matchingLoans.length} loans are high risk using this lender's score threshold of ${definition.highRiskScoreThreshold}.`,
      data: {
        definition: {
          concept: "high risk",
          minimumRiskScore: definition.highRiskScoreThreshold,
        },
        loans: matchingLoans.map((loan: LoanRecord) => ({
          id: loan.id,
          borrowerName: loan.borrowerName,
          riskScore: loan.riskScore,
          status: loan.status,
        })),
      },
      evidence: [
        {
          type: "definition",
          id: `high-risk-${context.lenderId}`,
          label: "Lender-specific definition",
          detail: `High risk is defined for this lender as risk score ${definition.highRiskScoreThreshold} or higher.`,
        },
      ],
      warnings: [],
      followUpSuggestions: ["Show me all defaulted high-risk loans above $50,000."],
    },
  };
};

export { lookupDefinition };
export type { DefinitionCapabilityDependencies };
