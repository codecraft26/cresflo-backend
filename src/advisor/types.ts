type UserRole = "admin" | "analyst" | "servicer";

type AdvisorRequestContext = {
  tenantId: string;
  userId: string;
  role: UserRole;
  lenderId: string;
};

type LoanStatus = "current" | "overdue" | "defaulted";

type Province = "Ontario" | "Quebec" | "Alberta" | "British Columbia";

type LoanRecord = {
  id: string;
  tenantId: string;
  borrowerName: string;
  province: Province;
  principalOutstanding: number;
  status: LoanStatus;
  riskScore: number;
  daysPastDue: number;
  interestCollectedLastQuarter: number;
  interestCollectedPreviousQuarter: number;
  propertyValue: number;
  extensionEligible: boolean;
};

type LenderDefinition = {
  overdueDaysThreshold: number;
  highRiskScoreThreshold: number;
};

type DocumentRecord = {
  id: string;
  tenantId: string;
  loanId?: string | null;
  title: string;
  type: "loan_agreement" | "policy" | "servicing_procedure" | "general";
  summary: string;
  sixMonthExtensionAllowed: boolean;
};

type ConversationMessageRole = "user" | "assistant";

type QueryConstraint =
  | {
      field: "status";
      operator: "eq";
      value: LoanStatus;
    }
  | {
      field: "principalOutstanding";
      operator: "gt" | "lt";
      value: number;
    }
  | {
      field: "province";
      operator: "in";
      value: Province[];
    }
  | {
      field: "borrowerName";
      operator: "contains";
      value: string;
    }
  | {
      field: "loanId";
      operator: "eq";
      value: string;
    }
  | {
      field: "riskScore" | "daysPastDue";
      operator: "gte" | "lte";
      value: number;
    }
  | {
      field: "propertyValue";
      operator: "gt" | "lt";
      value: number;
    }
  | {
      field: "extensionEligible";
      operator: "eq";
      value: boolean;
    };

type QuerySnapshot = {
  label: string;
  constraints: QueryConstraint[];
  resultLoanIds: string[];
};

type ConversationState = {
  id: string;
  context: AdvisorRequestContext;
  messages: {
    role: ConversationMessageRole;
    content: string;
    createdAt: string;
  }[];
  queryHistory: QuerySnapshot[];
  createdAt: string;
  updatedAt: string;
};

type EvidenceItem = {
  type: "loan" | "definition" | "document" | "system";
  id: string;
  label: string;
  detail: string;
};

type AdvisorAnswer = {
  summary: string;
  data?: Record<string, unknown>;
  evidence: EvidenceItem[];
  warnings: string[];
  followUpSuggestions: string[];
};

type AdvisorCapabilityResult = {
  answer: AdvisorAnswer;
  nextQuerySnapshot?: QuerySnapshot;
};

type PlannedAction =
  | {
      kind: "portfolio-search";
      filters: QueryConstraint[];
      label: string;
    }
  | {
      kind: "portfolio-breakdown";
      dimension: "province";
      source: "last-query";
    }
  | {
      kind: "query-rewind";
      steps: number;
    }
  | {
      kind: "definition-lookup";
      concept: "overdue" | "high risk";
    }
  | {
      kind: "document-check";
      loanId?: string;
      question: string;
    }
  | {
      kind: "missing-capability";
      capability: string;
      reason: string;
    }
  | {
      kind: "clarification";
      question: string;
    };

export type {
  AdvisorAnswer,
  AdvisorCapabilityResult,
  AdvisorRequestContext,
  ConversationMessageRole,
  ConversationState,
  DocumentRecord,
  EvidenceItem,
  LenderDefinition,
  LoanRecord,
  PlannedAction,
  Province,
  QueryConstraint,
  QuerySnapshot,
  UserRole,
};
