import type {
  AdvisorCapabilityResult,
  AdvisorRequestContext,
  LoanRecord,
  Province,
  QueryConstraint,
  QuerySnapshot,
} from "../types.js";
import type { PortfolioRepository } from "../repositories/portfolio.repository.js";

type PortfolioCapabilityDependencies = {
  portfolioRepository: PortfolioRepository;
};

const searchPortfolio = async (
  dependencies: PortfolioCapabilityDependencies,
  context: AdvisorRequestContext,
  filters: QueryConstraint[],
  label: string,
): Promise<AdvisorCapabilityResult> => {
  const records: LoanRecord[] = await dependencies.portfolioRepository.searchLoans(
    context,
    filters,
  );

  const snapshot: QuerySnapshot = {
    label,
    constraints: filters,
    resultLoanIds: records.map((record) => record.id),
  };

  return {
    answer: {
      summary: `Found ${records.length} loan${records.length === 1 ? "" : "s"} matching your request.`,
      data: {
          loans: records.map((record: LoanRecord) => ({
          id: record.id,
          borrowerName: record.borrowerName,
          province: record.province,
          principalOutstanding: record.principalOutstanding,
          status: record.status,
          riskScore: record.riskScore,
          daysPastDue: record.daysPastDue,
          propertyValue: record.propertyValue,
          extensionEligible: record.extensionEligible,
          interestCollectedLastQuarter: record.interestCollectedLastQuarter,
          interestCollectedPreviousQuarter: record.interestCollectedPreviousQuarter,
        })),
      },
      evidence: [
        {
          type: "system",
          id: "portfolio-search",
          label: "Trusted capability",
          detail:
            "Results were produced by the backend portfolio-search capability, not by free-form model calculation.",
        },
        ...records.map((record: LoanRecord) => ({
          type: "loan" as const,
          id: record.id,
          label: `${record.borrowerName} (${record.id})`,
          detail: `${record.status} loan in ${record.province} with principal ${record.principalOutstanding}.`,
        })),
      ],
      warnings: [],
      followUpSuggestions: [
        "Break this list down by province.",
        "Remove the last condition.",
        "Check whether one of these loans allows a six-month extension.",
      ],
    },
    nextQuerySnapshot: snapshot,
  };
};

const breakdownLastQueryByProvince = async (
  dependencies: PortfolioCapabilityDependencies,
  context: AdvisorRequestContext,
  snapshot: QuerySnapshot | undefined,
  requestedProvinces?: Province[],
): Promise<AdvisorCapabilityResult> => {
  if (!snapshot) {
    return {
      answer: {
        summary: "There is no earlier result set to break down yet.",
        evidence: [],
        warnings: ["Ask for a loan list first, then I can break that result down."],
        followUpSuggestions: ["Show me all defaulted loans with principal above $50,000."],
      },
    };
  }

  const scopedLoans: LoanRecord[] = (await dependencies.portfolioRepository.findLoansByIds(
    context,
    snapshot.resultLoanIds,
  )).filter((loan: LoanRecord) =>
    requestedProvinces ? requestedProvinces.includes(loan.province) : true,
  );

  const counts = scopedLoans.reduce<Record<string, number>>((accumulator, loan: LoanRecord) => {
    accumulator[loan.province] = (accumulator[loan.province] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    answer: {
      summary: `Province breakdown calculated from the prior result set (${scopedLoans.length} matching loans).`,
      data: {
        counts,
      },
      evidence: [
        {
          type: "system",
          id: "portfolio-breakdown",
          label: "Derived from prior query",
          detail: `Used the stored result set from "${snapshot.label}" within tenant scope.`,
        },
      ],
      warnings: [],
      followUpSuggestions: ["Remove the last condition and show me the original list again."],
    },
  };
};

const rewindQuery = async (
  dependencies: PortfolioCapabilityDependencies,
  context: AdvisorRequestContext,
  snapshots: QuerySnapshot[],
  steps: number,
): Promise<AdvisorCapabilityResult> => {
  const targetIndex = snapshots.length - 1 - steps;
  const targetSnapshot = snapshots[targetIndex];

  if (!targetSnapshot) {
    return {
      answer: {
        summary: "There is no earlier query state to restore.",
        evidence: [],
        warnings: ["The conversation does not have enough query history yet."],
        followUpSuggestions: [],
      },
    };
  }

  const restoredLoans = await dependencies.portfolioRepository.findLoansByIds(
    context,
    targetSnapshot.resultLoanIds,
  );

  return {
    answer: {
      summary: `Restored the earlier result set from "${targetSnapshot.label}".`,
      data: {
          loans: restoredLoans.map((record: LoanRecord) => ({
          id: record.id,
          borrowerName: record.borrowerName,
          province: record.province,
          principalOutstanding: record.principalOutstanding,
          status: record.status,
        })),
      },
      evidence: [
        {
          type: "system",
          id: "query-rewind",
          label: "Conversation memory",
          detail: "Used stored query snapshots instead of asking the model to reconstruct prior filters.",
        },
      ],
      warnings: [],
      followUpSuggestions: ["Break this list down by province."],
    },
    nextQuerySnapshot: targetSnapshot,
  };
};

export { breakdownLastQueryByProvince, rewindQuery, searchPortfolio };
export type { PortfolioCapabilityDependencies };
