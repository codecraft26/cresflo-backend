# cresflo-backend

Express + TypeScript backend scaffold with a Postgres + `pgvector` + Redis powered AI Advisor module.

## Structure

```text
src/
  app.ts
  server.ts
  advisor/
  config/
  controllers/
    advisor.controller.ts
    health.controller.ts
  infrastructure/
  middlewares/
    error-handler.ts
    not-found.ts
  routes/
    advisor.routes.ts
    health.routes.ts
    index.ts
  scripts/
    setup-advisor-db.ts
```

## Install dependencies

```bash
npm install
```

## Environment

```bash
cp .env.example .env
```

To use OpenAI for advisor planning and embeddings, set:

```env
ADVISOR_LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_LLM_MODEL=gpt-5
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

If `ADVISOR_LLM_PROVIDER=mock`, the backend keeps using the local rule-based planner.

## Prepare Postgres and Redis

If you want local infrastructure with Docker, start Postgres (with `pgvector`) and Redis from the backend folder:

```bash
docker compose up -d
```

This compose file starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

The default values in [.env.example](/Users/aman/Desktop/cresflo-backend/.env.example) already match that local setup.

After the containers are healthy, initialize the database schema:

```bash
npm run db:setup
```

`db:setup` expects a PostgreSQL database reachable at `DATABASE_URL` with the `pgvector` extension available. Redis is used for cached conversation reads; if you need to run without Redis temporarily, set `REDIS_ENABLED=false`.

When you are done, stop the local services with:

```bash
docker compose down
```

If you also want to remove the persisted local database/redis data:

```bash
docker compose down -v
```

## Superadmin organization endpoints

Set `SUPERADMIN_JWT_SECRET` in `.env`.

The local database setup seeds a default superadmin account:

```text
email: superadmin@cresflo.local
password: change-me
```

Login first:

```bash
POST /api/superadmin/login
```

Example login body:

```json
{
  "email": "superadmin@cresflo.local",
  "password": "change-me"
}
```

Use the returned bearer token for:

```bash
GET /api/superadmin/me
GET /api/superadmin/organizations
POST /api/superadmin/organizations
Header: Authorization: Bearer <accessToken>
```

Example create body:

```json
{
  "name": "Northbridge Capital",
  "slug": "northbridge-capital",
  "lenderId": "lender-northbridge",
  "overdueDaysThreshold": 30,
  "highRiskScoreThreshold": 75
}
```

Create organization users for a tenant:

```bash
POST /api/superadmin/organizations/:organizationId/users
Authorization: Bearer <superadminAccessToken>
```

Example body:

```json
{
  "email": "admin@northbridge.local",
  "fullName": "Northbridge Admin",
  "password": "YourStrongPassword123",
  "role": "admin"
}
```

## Organization user login and advisor access

Login as an organization user:

```bash
POST /api/organization-auth/login
```

Example body:

```json
{
  "email": "admin@northbridge.local",
  "password": "YourStrongPassword123"
}
```

Use the returned bearer token for:

```bash
GET /api/organization-auth/me
POST /api/advisor/conversations
GET /api/advisor/conversations/:conversationId
POST /api/advisor/conversations/:conversationId/messages
Authorization: Bearer <organizationAccessToken>
```

The advisor now derives `tenantId`, `lenderId`, `userId`, and `role` from the organization token instead of raw headers.

## Advisor WebSocket streaming

The backend also exposes a WebSocket endpoint for streaming chat UX:

```bash
ws://localhost:3000/ws/advisor?token=<organizationAccessToken>
```

Client messages:

```json
{ "type": "create_conversation" }
{ "type": "get_conversation", "conversationId": "..." }
{ "type": "send_message", "conversationId": "...", "message": "Show me overdue loans." }
```

Server events include:

```json
{ "type": "connected", "user": { "...": "..." } }
{ "type": "conversation_created", "conversation": { "...": "..." } }
{ "type": "planning_started", "conversationId": "..." }
{ "type": "plan_ready", "conversationId": "...", "planKind": "portfolio-search" }
{ "type": "message_chunk", "conversationId": "...", "chunk": "Found 3 loans..." }
{ "type": "message_complete", "conversationId": "...", "answer": { "...": "..." }, "conversation": { "...": "..." }, "provider": "..." }
{ "type": "error", "message": "..." }
```

## Build and start

```bash
npm run build
npm run start
```
