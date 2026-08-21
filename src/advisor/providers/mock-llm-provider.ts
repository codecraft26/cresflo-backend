import type { LlmProvider, PlanInput } from "./provider.js";
import type { PlannedAction, Province, QueryConstraint } from "../types.js";

const provinceNames: Province[] = [
  "Ontario",
  "Quebec",
  "Alberta",
  "British Columbia",
];

const detectProvinces = (message: string) => {
  const normalized = message.toLowerCase();

  return provinceNames.filter((province) =>
    normalized.includes(province.toLowerCase()),
  );
};

const detectPrincipalThreshold = (message: string) => {
  const amountMatch = message.match(/\$?(\d{2,3}(?:,\d{3})+)/);

  if (!amountMatch) {
    return null;
  }

  const amount = amountMatch[1];

  return amount ? Number(amount.replaceAll(",", "")) : null;
};

class MockLlmProvider implements LlmProvider {
  readonly name = "mock-rule-based-provider";

  async plan({ message, conversation }: PlanInput): Promise<PlannedAction> {
    const normalized = message.trim().toLowerCase();

    if (
      normalized.includes("remove the last condition") ||
      normalized.includes("show me the original list again")
    ) {
      return {
        kind: "query-rewind",
        steps: 1,
      };
    }

    if (
      normalized.includes("ontario") ||
      normalized.includes("quebec") ||
      normalized.includes("how many are in")
    ) {
      return {
        kind: "portfolio-breakdown",
        dimension: "province",
        source: "last-query",
      };
    }

    if (normalized.includes("overdue")) {
      return {
        kind: "definition-lookup",
        concept: "overdue",
      };
    }

    if (normalized.includes("high risk")) {
      return {
        kind: "definition-lookup",
        concept: "high risk",
      };
    }

    if (
      normalized.includes("loan agreement") ||
      normalized.includes("six-month extension") ||
      normalized.includes("six month extension")
    ) {
      const lastQueryLoanId =
        conversation.queryHistory[conversation.queryHistory.length - 1]
          ?.resultLoanIds[0];

      return {
        kind: "document-check",
        loanId: lastQueryLoanId,
        question: message,
      };
    }

    if (
      normalized.includes("what happens") &&
      normalized.includes("property values fall")
    ) {
      return {
        kind: "missing-capability",
        capability: "portfolio stress testing",
        reason:
          "No trusted backend stress-test engine is registered yet for scenario modeling.",
      };
    }

    if (normalized.includes("show me") || normalized.includes("all ")) {
      const filters: QueryConstraint[] = [];

      if (normalized.includes("defaulted")) {
        filters.push({
          field: "status",
          operator: "eq",
          value: "defaulted",
        });
      }

      const principalThreshold = detectPrincipalThreshold(message);

      if (principalThreshold !== null) {
        filters.push({
          field: "principalOutstanding",
          operator: "gt",
          value: principalThreshold,
        });
      }

      const provinces = detectProvinces(message);

      if (provinces.length > 0) {
        filters.push({
          field: "province",
          operator: "in",
          value: provinces,
        });
      }

      if (filters.length === 0) {
        return {
          kind: "clarification",
          question:
            "Which portfolio condition should I use? For example: defaulted, overdue, high risk, province, or principal threshold.",
        };
      }

      return {
        kind: "portfolio-search",
        filters,
        label: message,
      };
    }

    return {
      kind: "clarification",
      question:
        "I can help with portfolio filters, lender-defined concepts, and loan-agreement checks. Which of those should I use here?",
    };
  }
}

export { MockLlmProvider };
