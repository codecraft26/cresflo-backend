# Cresflo AI Advisor — Technical Design Exercise

## Overview

I would implement Cresflo AI Advisor as a dedicated advisor module/service that sits on top of Cresflo’s existing backend capabilities, not as a replacement for them.

The core principle is:

- the LLM interprets intent, manages conversation flow, and selects trusted capabilities;
- Cresflo backend capabilities remain the source of financial truth;
- PostgreSQL remains the durable system of record;
- `pgvector` is used for tenant-scoped document retrieval, not as the source of live portfolio truth;
- multi-tenant isolation is enforced before any capability runs.

That means the Advisor is a knowledge + tool/action system, not just a RAG chatbot.

## Architecture

```text
                                   Cresflo Web App
                                        |
                                   Next.js Frontend
                                        |
                     HTTP APIs + WebSocket streaming advisor channel
                                        |
                               Advisor API / BFF Layer
                                        |
                              AI Advisor Orchestrator
        ----------------------------------------------------------------
        |                      |                    |                    |
        |                      |                    |                    |
 Conversation State      Model Gateway        Capability Layer      Validation Layer
 (messages, query        (OpenAI now,         (trusted backend      (tenant scope,
 history, session)       swappable later)     functions/tools)      role, traceability)
        |                      |                    |                    |
        ----------------------------------------------------------------
                                        |
                             Existing Cresflo Backend Logic
          ---------------------------------------------------------------
          |                         |                      |             |
       Loans                    Payments               Documents      Policies /
       Schedules                Interest               Retrieval      Lender Rules
          |                         |                      |             |
          ---------------------------------------------------------------
                                        |
                                   PostgreSQL
                                        |
                         +-------------------------------+
                         |                               |
                  Relational data                 pgvector document chunks
                  conversations, users,          tenant-scoped embeddings
                  loans, definitions             for organization/loan docs
```

### Implemented prototype shape

In the working prototype I built:

- `superadmin` can log in and create organizations;
- `superadmin` can create organization users;
- organization users can log in and receive a tenant-bound token;
- advisor chat routes derive `tenantId`, `lenderId`, `role`, and `userId` from the organization token;
- advisor supports both HTTP chat flow and WebSocket streaming UX;
- conversation state is stored in PostgreSQL and cached in Redis;
- tenant-scoped documents are modeled in PostgreSQL + `pgvector`;
- OpenAI support is implemented behind a provider abstraction.

## End-to-end request workflow

### 1. Authentication and tenant resolution

1. A user logs in as an organization user.
2. The backend issues an organization-scoped token.
3. The token contains:
   - `tenantId`
   - `lenderId`
   - `userId`
   - `role`
4. Advisor requests must use this token.
5. The advisor never trusts arbitrary tenant headers for authenticated organization chat.

### 2. Natural language planning

1. The frontend sends a message to the advisor.
2. The advisor loads:
   - conversation history
   - prior query snapshots
   - organization context
3. The model gateway converts the message into a structured plan, for example:
   - `portfolio-search`
   - `portfolio-breakdown`
   - `query-rewind`
   - `definition-lookup`
   - `document-check`
   - `clarification`
   - `missing-capability`
4. The model is not allowed to directly answer from raw reasoning when a trusted capability exists.

### 3. Capability execution

The orchestrator routes the plan to a trusted backend capability:

- portfolio search queries trusted loan data;
- lender-specific concepts use stored organization/lender definitions;
- document checks use tenant-scoped retrieval from `documents` and `document_chunks`;
- unsupported requests return an explicit capability gap instead of a fabricated answer.

### 4. Response generation

The advisor returns:

- answer summary
- optional structured data
- evidence list
- warnings
- follow-up suggestions

The answer is therefore grounded in trusted application behavior and tenant-scoped retrieval.

### 5. State update

After the answer:

- the conversation message is stored;
- any new query snapshot is stored;
- conversation cache is refreshed in Redis;
- the frontend can reload the conversation or continue multi-turn chat.

## Key abstractions

These are the minimum abstractions I would keep stable as the system grows.

### `AdvisorRequestContext`

Carries:

- `tenantId`
- `userId`
- `lenderId`
- `role`

This is the minimum tenant/security context required before any capability executes.

### `ConversationState`

Stores:

- conversation id
- request context
- messages
- query history snapshots

This lets the advisor handle multi-turn questions like “of these” and “remove the last condition”.

### `PlannedAction`

This is the structured model output. It prevents the LLM from becoming the execution engine.

Example actions:

- `portfolio-search`
- `portfolio-breakdown`
- `query-rewind`
- `definition-lookup`
- `document-check`
- `missing-capability`
- `clarification`

### Capability interface

Every trusted function should behave like a backend tool:

- receives typed input
- runs inside tenant scope
- returns structured output plus evidence

That interface is more important than whether the advisor is packaged as a module or separate deployable service.

### Provider abstractions

I would preserve two separate provider layers:

- LLM planning provider
- embedding provider

That makes OpenAI/Gemini/Anthropic or internal models swappable without rewriting business orchestration.

## Scenario walkthroughs

### Scenario 1: Multi-turn portfolio query

User:

> Show me all defaulted loans with principal above $50,000.

Flow:

1. Planner returns `portfolio-search` with filters:
   - `status = defaulted`
   - `principalOutstanding > 50000`
2. Portfolio capability runs against tenant-scoped loan data.
3. Advisor stores a query snapshot.
4. Response includes matching loans and trusted evidence.

User:

> Of these, how many are in Ontario versus Quebec?

Flow:

1. Planner returns `portfolio-breakdown`.
2. Advisor reuses the last query snapshot.
3. Breakdown is computed from the stored result set, not from model memory.
4. Response returns counts by province.

User:

> Remove the last condition and show me the original list again.

Flow:

1. Planner returns `query-rewind`.
2. Advisor restores the earlier snapshot.
3. The result set is reconstructed from stored conversation state.

This is a good example of why multi-turn state should be explicit and query-based, not only conversational text.

### Scenario 2: Lender-specific concept

User:

> How many loans are overdue?

Flow:

1. Planner returns `definition-lookup`.
2. Advisor loads the lender-specific overdue definition for that tenant/lender.
3. Portfolio capability applies that threshold to tenant-scoped loan data.
4. The answer explicitly cites the definition used.

This matters because “overdue” is not universal truth. It is organization-specific policy.

### Scenario 3: Document question

User:

> Does this loan agreement allow a six-month extension?

Flow:

1. Planner returns `document-check`.
2. Advisor identifies the relevant loan and tenant scope.
3. Document retrieval searches indexed chunks in `pgvector`, filtered by `tenant_id`.
4. The final answer is grounded in:
   - document summary
   - retrieved clauses
   - loan context
5. The response includes a warning that final legal review should use source documents.

### Scenario 4: Missing capability

User:

> What happens to the portfolio if property values fall by 10%?

Flow:

1. Planner recognizes the request.
2. Advisor checks capability availability.
3. If a trusted stress-testing capability does not exist, the advisor does not simulate from the model.
4. It returns a structured missing-capability response describing the gap.

This is safer than pretending the model can produce financial scenario analysis correctly on its own.

## Correctness and safety

### 1. The model is not the source of financial truth

The model is allowed to:

- interpret language
- resolve conversational references
- choose a capability
- ask for clarification

The model is not allowed to:

- become the authoritative calculator
- directly run SQL
- bypass existing Cresflo financial logic
- invent missing data or unsupported analysis

### 2. Tenant isolation is enforced first

Every advisor request is bound to organization context before capability execution.

That tenant context must flow through:

- chat session
- capability calls
- document retrieval
- lender definitions
- action authorization

### 3. Traceable answers

Responses should carry evidence. For example:

- matching loans
- applied lender definition
- retrieved document clauses
- capability name used

This makes responses auditable and easier to debug.

### 4. Ambiguity handling

If the request is ambiguous, the advisor should pause and ask a targeted clarification question instead of guessing.

Examples:

- “high risk” without a configured definition
- a document question without a loan reference
- a broad request with no trusted capability mapping

### 5. Role-aware action boundary

Today’s prototype mainly covers questions.

For actions, I would require:

- role permission check
- capability-specific validation
- audit log
- optional approval step for high-impact operations

## Documents in the architecture

Documents should be tenant-scoped assets, optionally linked to loan, borrower, or policy context.

Recommended hierarchy:

- organization-level documents
  - lending policy
  - underwriting standards
  - servicing SOPs
- loan-level documents
  - loan agreement
  - amendment
  - appraisal
- borrower-level documents
  - financial statements
  - borrower correspondence

Each document should carry metadata such as:

```json
{
  "tenantId": "org_123",
  "loanId": "loan_456",
  "documentId": "doc_789",
  "documentType": "loan_agreement",
  "version": 2
}
```

### Important design distinction

- RAG is appropriate for documents, policies, and definitions.
- RAG is not the primary source for current balances, defaults, interest, payments, or other live financial truth.

For those, the advisor should call trusted backend capabilities.

## Scale and evolution

### Early stage

At a modest scale, I would keep the advisor inside the existing backend as a dedicated module:

```text
backend/
  modules/
    loans/
    payments/
    documents/
    advisor/
      orchestrator.ts
      model-gateway.ts
      capability-registry.ts
      conversation-state.ts
      validator.ts
```

This reduces operational complexity while preserving the right boundaries.

### As capabilities grow

As the number of concepts and tools grows into the hundreds or thousands, I would evolve toward:

- capability registry with rich metadata
- structured planner prompts over capability schemas
- capability grouping by domain
  - portfolio
  - payments
  - servicing
  - documents
  - tasks/actions
- evaluation harnesses by capability family
- explicit fallback when no trusted capability exists

### Capability metadata should include

- capability id
- description
- required permissions
- tenant scope requirements
- input schema
- output schema
- traceability metadata
- whether it is read-only or action-oriented

This avoids a future where the model prompt becomes an unmanageable list of raw tool descriptions.

## What happens when a capability is missing

If a request is conceptually valid but unsupported, the advisor should:

1. acknowledge the intent;
2. state that a trusted capability does not exist yet;
3. avoid hallucinating the answer;
4. optionally suggest the backend capability needed.

This is operationally important, because some of the most useful advisor requests will be the ones that expose missing platform capabilities.

## Evaluation

I would evaluate the advisor on five axes.

### 1. Capability selection accuracy

Can the planner reliably choose the correct capability or clarification path?

### 2. Tenant and permission correctness

Can it ever cross tenants, misuse role permissions, or retrieve irrelevant documents?

This should be tested aggressively.

### 3. Financial correctness

For every portfolio/payments/calculation capability, does the advisor answer match Cresflo backend truth?

### 4. Multi-turn state correctness

Can it properly handle:

- “of these”
- “same list”
- “remove the last condition”
- “compare to previous quarter”

### 5. User usefulness

Does the advisor save real lender time?

I would track:

- successful task completion rate
- clarification rate
- missing-capability rate
- response confidence / escalation rate
- user adoption by workflow

## Open questions before finalizing

These are the three questions I would want answered before finalizing the production architecture.

### 1. What Cresflo backend capabilities already exist as reusable APIs?

This determines how much the first advisor version can safely do without building new financial service contracts.

### 2. What document sources already exist?

If Cresflo already stores agreements and documents, the first document version can integrate them directly. If not, document ingestion needs to become part of the MVP.

### 3. What actions should be allowed in phase one?

Answering questions is lower risk than taking actions. The action boundary changes approval flow, audit design, and permission requirements significantly.

## Product thinking

To make the advisor something a lender uses every day, it should eventually move beyond Q&A and help with actual operational work.

It should be able to:

- investigate:
  - defaults
  - overdue balances
  - falling collections
  - borrower deterioration
- prepare:
  - renewal recommendations
  - borrower summaries
  - watchlists
  - credit committee briefing notes
- monitor:
  - loans approaching maturity
  - missed payments
  - covenant issues
  - concentration risk
- recommend:
  - which loans need attention now
  - why they matter
  - which follow-up actions to take
- perform:
  - create task
  - prepare renewal workflow
  - generate report
  - notify servicing/admin users

That is the path from “interesting assistant” to “daily operating surface”.

## What is implemented in the working prototype

As of August 21, 2026, the prototype implementation includes:

- superadmin login
- organization creation
- organization user creation
- organization user login
- organization-scoped advisor auth
- PostgreSQL-backed conversation state
- Redis-backed conversation caching
- `pgvector`-based tenant-scoped document retrieval model
- OpenAI-ready provider integration
- HTTP advisor routes
- WebSocket streaming advisor UX
- reusable Next.js frontend to exercise the full current flow

## What remains for a fuller production version

The main remaining gaps are:

- organization-level document upload and ingestion pipeline
- real loan and portfolio ingestion APIs
- broader trusted capability registry
- richer evaluation and observability tooling
- action workflows with approval and audit depth
- true token-level model streaming

## Conclusion

My recommendation is to build Cresflo AI Advisor as a dedicated orchestration layer that sits above trusted Cresflo backend capabilities and below a multi-turn user interface.

The most important design decision is not the specific model vendor. It is preserving the boundary that:

- the model interprets;
- Cresflo capabilities decide what is financially true;
- tenant isolation and permissions are enforced before execution;
- documents are retrieved within tenant scope;
- missing capabilities are surfaced honestly instead of hallucinated.

That architecture is strong enough for an MVP and scalable enough to evolve into a much broader lender operating system assistant over time.
