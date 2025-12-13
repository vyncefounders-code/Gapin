# GAPIN + AIBBAR — MVP Task List & Execution Plan

**Mission:** Build the unified event streaming + AI safety platform before investor pitch  
**Scope:** Phase 2 (MVP Completion)  
**Effort:** 8-10 weeks  
**Investors:** Ready after Phase 2 completion

---

## 📋 Quick Summary

This document is the **execution bible** for completing GAPIN/AIBBAR MVP.

**Current Status:**
- ✅ Phase 1 (Foundation): 100% Complete
- 🟡 Phase 2 (MVP): 0% → 100% (this roadmap)
- ⚪ Phase 3 (AI Features): Post-MVP
- ⚪ Phase 4 (Launch): Post-MVP

**Deliverables After MVP:**
- Working developer dashboard
- API key authentication + rate limiting
- AIBBAR event schema + recording
- Full SDK feature set
- Production-ready deployment
- Investor pitch materials

---

## 🎯 Phase 2 Breakdown (8-10 weeks)

### Week 1-2: Security & Auth (Foundation)

**Goal:** Make platform secure and authenticated before MVP features.

#### Task 2.1: API Key System

**Description:** Users generate unique API keys to authenticate requests.

**Subtasks:**
- [ ] Create `api_keys` table
  ```sql
  CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_preview VARCHAR(10), -- "sk_abc123..."
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
  );
  ```

- [ ] Implement key generation endpoint
  - `POST /api/v1/keys` → generate new key
  - Return full key once (store hashed)
  - Return 32-character format: `sk_[24_random_chars]`

- [ ] Implement key rotation endpoint
  - `DELETE /api/v1/keys/:key_id` → revoke key
  - `POST /api/v1/keys/:key_id/rotate` → new key, invalidate old

- [ ] Database: hash keys with bcrypt before storing
- [ ] Log all key operations (creation, rotation, revocation)

**Files to Create/Modify:**
- `packages/gateway/src/db/migrations/001_create_api_keys.sql`
- `packages/gateway/src/controllers/keyController.ts`
- `packages/gateway/src/routes/keys.ts`

**Effort:** 1.5 days  
**Dependencies:** None (foundation ready)

---

#### Task 2.2: Auth Middleware

**Description:** Validate API key on every protected request.

**Subtasks:**
- [ ] Create auth middleware
  ```typescript
  // packages/gateway/src/middleware/auth.ts
  export async function authMiddleware(request, reply) {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Missing API key' });
    }
    // Hash token
    const hash = bcrypt(token);
    // Look up in DB
    const key = await pool.query(
      'SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = TRUE',
      [hash]
    );
    if (!key.rows[0]) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }
    // Attach to request
    request.apiKey = key.rows[0];
  }
  ```

- [ ] Apply middleware to protected routes:
  - `POST /events/publish` ← require auth
  - `GET /events/read` ← require auth
  - `POST /users` ← require auth
  - `GET /users/:id` ← require auth
  - `GET /users` ← require auth
  - Keep `/health` open (no auth)

- [ ] Update test suite to include API key in headers

**Effort:** 1 day  
**Files:**
- `packages/gateway/src/middleware/auth.ts`
- `packages/gateway/src/index.ts` (register middleware)

---

#### Task 2.3: Rate Limiting

**Description:** Limit requests per API key to prevent abuse.

**Subtasks:**
- [ ] Install `@fastify/rate-limit` package
  ```bash
  npm install @fastify/rate-limit
  ```

- [ ] Configure rate limiting
  - Default: 1000 requests/minute per key
  - Default: 100,000 events/day per key
  - Customizable per API key (upgrade tiers)

- [ ] Implement Redis cache (for distributed rate limiting)
  - `npm install redis`
  - Store counters in Redis
  - Key format: `rate_limit:${apiKeyId}:${window}`

- [ ] Return rate limit headers
  ```
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 950
  X-RateLimit-Reset: 1702464000
  ```

- [ ] Return 429 Too Many Requests when exceeded

**Effort:** 1.5 days  
**Files:**
- `packages/gateway/src/middleware/rateLimit.ts`
- Update docker-compose.yml to include Redis service

---

### Week 3: AIBBAR Event Schema & Recording

**Goal:** Define and implement AIBBAR event logging system.

#### Task 3.1: AIBBAR Event Schema

**Description:** Define standardized schema for all AIBBAR events.

**Subtasks:**
- [ ] Create event schema TypeScript interface
  ```typescript
  // packages/gateway/src/schemas/aibbarEvent.ts
  export interface AIBBAREvent {
    event_type: 'ai.action' | 'ai.decision' | 'ai.error' | 'ai.query' | 'ai.response';
    ai_id: string; // UUID of AI system
    ai_version: string; // e.g., "gpt-4-turbo"
    timestamp: ISO8601;
    action?: {
      function: string;
      input: any;
      output: any;
      latency_ms: number;
      model: string;
      tokens_used?: number;
    };
    decision?: {
      type: string;
      logic: string;
      options: any[];
      chosen: any;
      confidence: number;
    };
    error?: {
      code: string;
      message: string;
      stack?: string;
      recoverable: boolean;
    };
    metadata: {
      user_id?: string;
      session_id?: string;
      request_id?: string;
      source_ip?: string;
      country?: string;
      region?: string;
    };
    signature: string; // HMAC-SHA256
    signature_algorithm: 'HMAC-SHA256';
  }
  ```

- [ ] Create schema validator (Zod or ajv)
  - Strict validation
  - Reject non-conforming events
  - Log validation failures for debugging

- [ ] Create migrations for AIBBAR event table
  ```sql
  CREATE TABLE aibbar_events (
    id BIGSERIAL PRIMARY KEY,
    ai_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT idx_ai_id_created ON (ai_id, created_at)
  );
  
  CREATE INDEX idx_aibbar_ai_id ON aibbar_events(ai_id);
  CREATE INDEX idx_aibbar_created ON aibbar_events(created_at DESC);
  CREATE INDEX idx_aibbar_type ON aibbar_events(event_type);
  ```

**Effort:** 1.5 days  
**Files:**
- `packages/gateway/src/schemas/aibbarEvent.ts`
- `packages/gateway/src/validators/aibbarValidator.ts`
- `packages/gateway/db/migrations/002_create_aibbar_events.sql`

---

#### Task 3.2: Event Signature & Hashing

**Description:** Sign events with HMAC to ensure integrity.

**Subtasks:**
- [ ] Implement event signer
  ```typescript
  // packages/gateway/src/utils/signer.ts
  import crypto from 'crypto';
  
  export function signEvent(event: any, secret: string): string {
    const payload = JSON.stringify(event);
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }
  
  export function verifyEvent(event: any, signature: string, secret: string): boolean {
    const calculated = signEvent(event, secret);
    return crypto.timingSafeEqual(
      Buffer.from(calculated),
      Buffer.from(signature)
    );
  }
  ```

- [ ] Store signing secret securely
  - Environment variable: `AIBBAR_SIGNING_SECRET`
  - Rotate annually
  - Support key versioning

- [ ] Add signature verification middleware
  - Verify on all AIBBAR events
  - Reject unsigned events
  - Log verification failures

**Effort:** 1 day  
**Files:**
- `packages/gateway/src/utils/signer.ts`
- `packages/gateway/src/middleware/aibbarVerify.ts`

---

#### Task 3.3: AIBBAR Recorder Service

**Description:** Accept and store AIBBAR events.

**Subtasks:**
- [ ] Create new endpoint: `POST /aibbar/events`
  - Accept AIBBAR events
  - Validate schema
  - Verify signature
  - Normalize/sanitize data

- [ ] Implement data normalization
  - Redact PII (email, phone, SSN)
  - Mask passwords/tokens
  - Standardize timestamps
  - Add system metadata

- [ ] Store event flow
  1. Validate schema
  2. Verify signature
  3. Normalize data
  4. Write to Kafka topic: `aibbar.events`
  5. Write to PostgreSQL: `aibbar_events` table
  6. Return event ID

- [ ] Error handling
  - Validation errors → 400 Bad Request
  - Signature errors → 401 Unauthorized
  - Storage errors → 500 Internal Server Error
  - All errors logged with context

**Effort:** 2 days  
**Files:**
- `packages/gateway/src/controllers/aibbarController.ts`
- `packages/gateway/src/routes/aibbar.ts`

---

### Week 4: Developer Dashboard Foundation (Next.js)

**Goal:** Create frontend for API key management, topic viewing, event streaming.

#### Task 4.1: Next.js Project Setup

**Description:** Initialize Next.js dashboard application.

**Subtasks:**
- [ ] Create Next.js project
  ```bash
  cd packages
  npx create-next-app@latest dashboard --typescript --tailwind
  ```

- [ ] Install dependencies
  ```bash
  npm install next react react-dom typescript tailwindcss
  npm install axios zustand react-query
  npm install next-auth
  npm install recharts # charting
  npm install axios # API client
  ```

- [ ] Setup project structure
  ```
  packages/dashboard/
  ├── app/
  │   ├── layout.tsx (main layout)
  │   ├── page.tsx (home)
  │   ├── login/
  │   ├── dashboard/
  │   ├── api-keys/
  │   ├── topics/
  │   ├── events/
  │   └── metrics/
  ├── components/
  │   ├── Navbar.tsx
  │   ├── Sidebar.tsx
  │   ├── DataTable.tsx
  │   └── EventViewer.tsx
  ├── lib/
  │   ├── api.ts (API client)
  │   └── auth.ts (NextAuth config)
  └── package.json
  ```

- [ ] Configure environment variables
  ```
  NEXT_PUBLIC_API_URL=http://localhost:3000
  NEXTAUTH_URL=http://localhost:3001
  NEXTAUTH_SECRET=[random_string]
  ```

**Effort:** 2 days  
**Files:**
- `packages/dashboard/` (new directory)

---

#### Task 4.2: Authentication Pages

**Description:** Login/signup pages with NextAuth.

**Subtasks:**
- [ ] Create login page (`app/login/page.tsx`)
  - Email + password form
  - Google OAuth button
  - GitHub OAuth button
  - "Forgot password" link
  - Link to signup

- [ ] Create signup page (`app/auth/signup/page.tsx`)
  - Email + password + name form
  - Terms acceptance checkbox
  - Link to login

- [ ] Configure NextAuth.js
  ```typescript
  // app/api/auth/[...nextauth]/route.ts
  import NextAuth from 'next-auth';
  import Credentials from 'next-auth/providers/credentials';
  import Google from 'next-auth/providers/google';
  
  export const authOptions = {
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
      Credentials({
        name: 'Credentials',
        credentials: {
          email: {},
          password: {},
        },
        async authorize(credentials) {
          // Validate against gateway API
          const res = await fetch('http://localhost:3000/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
          });
          if (res.ok) return await res.json();
          return null;
        },
      }),
    ],
  };
  
  export default NextAuth(authOptions);
  ```

- [ ] Create protected layout
  - Redirect unauthenticated users to `/login`
  - Show user profile in navbar

**Effort:** 2 days  
**Files:**
- `packages/dashboard/app/login/page.tsx`
- `packages/dashboard/app/auth/signup/page.tsx`
- `packages/dashboard/app/api/auth/[...nextauth]/route.ts`

---

#### Task 4.3: API Keys Management Page

**Description:** UI for generating and managing API keys.

**Subtasks:**
- [ ] Create API keys page (`app/dashboard/api-keys/page.tsx`)
  - List existing keys (masked: `sk_abc123...`)
  - "Generate New Key" button
  - Revoke button per key
  - Copy to clipboard
  - Last used timestamp
  - Expiration date

- [ ] Implement key generation modal
  - Click "Generate" → request to gateway
  - Show full key once (with copy button)
  - Warning: "Save this key, we won't show it again"
  - Confirm to close modal

- [ ] Implement revocation modal
  - Click "Revoke" → confirmation
  - Immediate revocation
  - Show success toast

- [ ] API client methods
  ```typescript
  // lib/api.ts
  export async function listApiKeys(token: string) {
    return fetch(`${API_URL}/api/v1/keys`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
  }
  
  export async function generateApiKey(token: string) {
    return fetch(`${API_URL}/api/v1/keys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
  }
  
  export async function revokeApiKey(token: string, keyId: string) {
    return fetch(`${API_URL}/api/v1/keys/${keyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
  }
  ```

**Effort:** 2 days  
**Files:**
- `packages/dashboard/app/dashboard/api-keys/page.tsx`
- `packages/dashboard/components/KeysList.tsx`
- `packages/dashboard/components/GenerateKeyModal.tsx`

---

### Week 5-6: Dashboard Features (Events, Topics, Metrics)

#### Task 5.1: Topics Management Page

**Description:** View and manage Kafka topics.

**Subtasks:**
- [ ] Create topics page (`app/dashboard/topics/page.tsx`)
  - List all topics
  - Create new topic
  - View topic stats:
    - Number of partitions
    - Number of consumers
    - Total events (30 days)
    - Events today
    - Error rate

- [ ] Create topic dialog
  - Topic name input
  - Number of partitions (default 10)
  - Retention (7, 14, 30 days)
  - Create button

- [ ] Topic detail view
  - Overview stats
  - Consumer groups subscribed
  - Consumer lag per group
  - Events timeline (chart)
  - Error timeline (chart)
  - Topic configuration (editable)

**Effort:** 3 days  
**Files:**
- `packages/dashboard/app/dashboard/topics/page.tsx`
- `packages/dashboard/components/TopicsList.tsx`
- `packages/dashboard/components/TopicDetail.tsx`

---

#### Task 5.2: Events Viewer (Real-Time)

**Description:** Stream and display events in real-time.

**Subtasks:**
- [ ] Create events page (`app/dashboard/events/page.tsx`)
  - Real-time event stream
  - Filters:
    - Topic (dropdown)
    - Date range
    - Search in message content
  - Table columns:
    - Timestamp
    - Topic
    - Event ID
    - Message preview
    - View full button

- [ ] Implement WebSocket for real-time updates
  ```typescript
  // lib/events.ts
  export function subscribeToEvents(
    token: string,
    onEvent: (event: any) => void
  ) {
    const ws = new WebSocket(
      `${API_URL.replace('http', 'ws')}/ws/events?token=${token}`
    );
    ws.onmessage = (msg) => onEvent(JSON.parse(msg.data));
    return ws;
  }
  ```

- [ ] Full event viewer modal
  - Show full JSON
  - Syntax highlighting
  - Copy button
  - Download button
  - Expand/collapse sections

- [ ] Event filtering
  - By topic (from URL params)
  - By date range
  - By content search
  - Save filters

**Effort:** 3 days  
**Files:**
- `packages/dashboard/app/dashboard/events/page.tsx`
- `packages/dashboard/components/EventsStream.tsx`
- `packages/dashboard/components/EventViewer.tsx`
- `packages/gateway/src/websocket/events.ts` (backend)

---

#### Task 5.3: Metrics Dashboard

**Description:** Real-time charts and KPIs.

**Subtasks:**
- [ ] Create metrics page (`app/dashboard/metrics/page.tsx`)
  - KPI cards:
    - Events today
    - Events/sec
    - Avg latency
    - Error rate
    - Active consumers

- [ ] Charts (using Recharts)
  - Throughput over time (line chart)
  - Error rate over time (area chart)
  - Consumer lag (bar chart)
  - Top topics (pie chart)
  - Top error types (bar chart)

- [ ] Implement metrics API endpoints (gateway)
  - `GET /metrics` (Prometheus format)
  - `GET /api/v1/metrics/throughput?period=1h`
  - `GET /api/v1/metrics/errors?period=1h`
  - `GET /api/v1/metrics/lag`

- [ ] Refresh strategy
  - Auto-refresh every 10 seconds
  - Manual refresh button
  - Configurable time windows (1h, 6h, 24h)

**Effort:** 3 days  
**Files:**
- `packages/dashboard/app/dashboard/metrics/page.tsx`
- `packages/dashboard/components/MetricsCards.tsx`
- `packages/dashboard/components/Charts/`
- `packages/gateway/src/controllers/metricsController.ts`

---

### Week 7: SDKs Polish & Testing

#### Task 6.1: JavaScript SDK Enhancements

**Description:** Add production features to JS SDK.

**Subtasks:**
- [ ] Add retry logic
  ```typescript
  export class Client {
    async publishEvent(
      topic: string,
      message: any,
      options?: { retries?: number; backoff?: number }
    ) {
      let lastError;
      const maxRetries = options?.retries ?? 3;
      const backoffMs = options?.backoff ?? 100;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await this._publish(topic, message);
        } catch (error) {
          lastError = error;
          await new Promise(resolve => 
            setTimeout(resolve, backoffMs * Math.pow(2, i))
          );
        }
      }
      throw lastError;
    }
  }
  ```

- [ ] Add streaming consumption
  ```typescript
  async function *streamEvents(client: Client) {
    const ws = new WebSocket(`${client.baseUrl}/ws/events`);
    for await (const event of asyncIterableWebSocket(ws)) {
      yield event;
    }
  }
  ```

- [ ] Add connection pooling
  - Reuse HTTP connections
  - Implement keep-alive
  - Handle connection resets

- [ ] Unit tests with Jest
  - Test publish success
  - Test publish with retry
  - Test stream consumption
  - Mock axios responses

- [ ] Integration tests
  - Real gateway endpoint
  - End-to-end flow
  - Error scenarios

**Effort:** 2 days  
**Files:**
- `packages/sdk-js/src/index.ts` (enhance)
- `packages/sdk-js/tests/` (new)

---

#### Task 6.2: Python SDK Enhancements

**Description:** Add production features to Python SDK.

**Subtasks:**
- [ ] Add async support
  ```python
  import asyncio
  import aiohttp
  
  class AsyncClient:
    async def publish_event(self, topic: str, message: dict):
      async with aiohttp.ClientSession() as session:
        async with session.post(...) as resp:
          return await resp.json()
  ```

- [ ] Add producer batching
  ```python
  class BatchProducer:
    def __init__(self, client, batch_size=100):
      self.batch = []
      self.batch_size = batch_size
    
    def add(self, topic: str, message: dict):
      self.batch.append((topic, message))
      if len(self.batch) >= self.batch_size:
        self.flush()
    
    def flush(self):
      # Send batch
      pass
  ```

- [ ] Add pytest tests
  - Test publish
  - Test async operations
  - Test error handling
  - Mock requests

- [ ] Documentation
  - Update README with examples
  - Add docstrings to all methods
  - Create example notebook

**Effort:** 2 days  
**Files:**
- `packages/sdk-python/src/gapin_sdk/` (enhance)
- `packages/sdk-python/tests/` (new)

---

### Week 8: Deployment & Infrastructure

#### Task 7.1: Production Docker Setup

**Description:** Create production-ready Docker configurations.

**Subtasks:**
- [ ] Create multi-stage Dockerfile for gateway
  ```dockerfile
  # Build stage
  FROM node:18-alpine AS builder
  WORKDIR /app
  COPY . .
  RUN npm ci
  RUN npm run build
  
  # Runtime stage
  FROM node:18-alpine
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  RUN addgroup -g 1001 -S nodejs
  RUN adduser -S nodejs -u 1001
  USER nodejs
  EXPOSE 3000
  HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
  CMD ["node", "dist/index.js"]
  ```

- [ ] Create docker-compose for local dev
  - Gateway service
  - Postgres service
  - Redpanda service
  - Redis service
  - Dashboard service (Next.js)
  - Volumes for persistence
  - Health checks for all services

- [ ] Create docker-compose for production
  - Add Grafana for monitoring
  - Add Prometheus for metrics
  - Add Loki for logs
  - Add Nginx reverse proxy

**Effort:** 2 days  
**Files:**
- `packages/gateway/Dockerfile`
- `packages/dashboard/Dockerfile`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`

---

#### Task 7.2: Kubernetes Manifests (Optional)

**Description:** Create K8s manifests for cloud deployment.

**Subtasks:**
- [ ] Create Helm chart structure
  ```
  helm/gapin/
  ├── Chart.yaml
  ├── values.yaml
  ├── templates/
  │   ├── gateway-deployment.yaml
  │   ├── gateway-service.yaml
  │   ├── postgres-statefulset.yaml
  │   ├── postgres-service.yaml
  │   ├── redpanda-statefulset.yaml
  │   └── configmap.yaml
  ```

- [ ] Define resource limits
  - Gateway: CPU 1, RAM 1GB
  - Postgres: CPU 2, RAM 4GB
  - Redpanda: CPU 2, RAM 4GB

- [ ] Setup autoscaling
  ```yaml
  apiVersion: autoscaling/v2
  kind: HorizontalPodAutoscaler
  metadata:
    name: gateway-hpa
  spec:
    scaleTargetRef:
      apiVersion: apps/v1
      kind: Deployment
      name: gateway
    minReplicas: 2
    maxReplicas: 10
    metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
  ```

**Effort:** 2 days (optional for MVP)  
**Priority:** Phase 2 (post-MVP)

---

#### Task 7.3: CI/CD Pipeline

**Description:** GitHub Actions for automated testing and deployment.

**Subtasks:**
- [ ] Create `.github/workflows/test.yml`
  - Lint (ESLint, Prettier)
  - Type check (tsc)
  - Unit tests (Jest, pytest)
  - Integration tests

- [ ] Create `.github/workflows/build.yml`
  - Build Docker images
  - Push to Docker Hub / GitHub Registry
  - Tag with git hash and semver

- [ ] Create `.github/workflows/deploy.yml`
  - Deploy to staging on main branch
  - Manual approval for production
  - Update deployment status

**Effort:** 2 days  
**Files:**
- `.github/workflows/test.yml`
- `.github/workflows/build.yml`
- `.github/workflows/deploy.yml`

---

### Week 9: Testing & QA

#### Task 8.1: Performance Testing

**Description:** Verify system handles 10k+ events/min.

**Subtasks:**
- [ ] Load test setup
  - Use `k6` or `Apache JMeter`
  - Script: publish 10k events over 1 minute
  - Measure: throughput, latency, errors

- [ ] Run load tests
  ```bash
  npm run load-test
  ```

- [ ] Identify bottlenecks
  - CPU usage
  - Memory usage
  - DB connection pool saturation
  - Kafka producer throughput

- [ ] Baseline results
  - Throughput: > 5k events/sec
  - P95 latency: < 100ms
  - Error rate: < 0.1%
  - Memory: stable over time

**Effort:** 2 days  
**Files:**
- `packages/gateway/load-tests/` (new)

---

#### Task 8.2: Integration Testing

**Description:** End-to-end scenario testing.

**Subtasks:**
- [ ] Test scenario: Publish → Kafka → DB → Read
  - Publish 100 events
  - Verify all reach Kafka
  - Verify all stored in DB
  - Read back and verify content

- [ ] Test scenario: Consumer restart
  - Start consumer
  - Publish 50 events
  - Restart consumer (kill + restart)
  - Verify no data loss
  - Verify resume from last offset

- [ ] Test scenario: Graceful shutdown
  - Start gateway
  - In-flight requests during shutdown
  - Verify completion
  - Verify no orphaned connections

- [ ] Test scenario: Error recovery
  - Kill Kafka
  - Try to publish → should queue
  - Restart Kafka
  - Verify recovery and flush

**Effort:** 2 days  
**Files:**
- `packages/gateway/tests/integration/` (new)

---

### Week 10: Documentation & Investor Prep

#### Task 9.1: API Documentation

**Description:** OpenAPI spec and interactive docs.

**Subtasks:**
- [ ] Create OpenAPI 3.0 spec
  ```yaml
  openapi: 3.0.0
  info:
    title: GAPIN API
    version: 1.0.0
  paths:
    /events/publish:
      post:
        summary: Publish event
        security:
          - bearerAuth: []
        requestBody:
          required: true
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/EventPayload'
        responses:
          '200':
            description: Event published
          '400':
            description: Invalid payload
          '401':
            description: Unauthorized
  ```

- [ ] Setup Swagger UI
  - Serve at `/api/docs`
  - Interactive endpoint testing
  - Request/response examples

- [ ] Create API guide document
  - Authentication flows
  - Error codes
  - Rate limiting info
  - Best practices

**Effort:** 1 day  
**Files:**
- `docs/openapi.yaml`
- `packages/gateway/src/routes/docs.ts`

---

#### Task 9.2: Architecture Documentation

**Description:** Diagrams and explanations for investors.

**Subtasks:**
- [ ] Create system architecture diagram
  - Components (Gateway, Kafka, DB, SDKs)
  - Data flow
  - External integrations

- [ ] Create deployment architecture
  - Local dev setup
  - Cloud deployment
  - High availability setup

- [ ] Create sequence diagram
  - Event publish flow
  - Consumer flow
  - Auth flow

- [ ] Create scalability explanation
  - Horizontal scaling
  - Database sharding
  - Kafka partitioning

**Effort:** 2 days  
**Files:**
- `docs/ARCHITECTURE.md`
- `docs/diagrams/` (images)

---

#### Task 9.3: Pitch Deck & Marketing

**Description:** Investor-ready materials.

**Subtasks:**
- [ ] Create 15-slide pitch deck
  1. Title slide (problem statement)
  2. Market size
  3. Our solution
  4. How it works (demo)
  5. Technology (architecture)
  6. Competitive advantage
  7. Use cases
  8. Go-to-market strategy
  9. Business model
  10. Traction
  11. Team
  12. Financials (projections)
  13. Ask
  14. Closing

- [ ] Create 5-minute demo video
  - Create API key
  - Publish event
  - View in dashboard
  - Show metrics

- [ ] Create one-pager summary
  - Mission
  - Problem
  - Solution
  - Market opportunity
  - Ask

**Effort:** 3 days  
**Files:**
- `pitch/PITCH_DECK.md`
- `pitch/DEMO_SCRIPT.md`
- `pitch/ONE_PAGER.md`

---

## 📊 Task Timeline & Effort

| Week | Focus | Effort | Status |
|------|-------|--------|--------|
| 1-2 | Security & Auth | 4 days | 🟡 Critical |
| 3 | AIBBAR Schema | 4 days | 🟡 Critical |
| 4 | Dashboard Foundations | 4 days | 🟡 High |
| 5-6 | Dashboard Features | 9 days | 🟡 High |
| 7 | SDK Polish | 4 days | 🟡 Medium |
| 8 | Deployment | 6 days | 🟡 High |
| 9 | Testing | 4 days | 🟡 High |
| 10 | Docs & Pitch | 6 days | 🟡 High |
| **Total** | **MVP Complete** | **41 days** | **8-10 weeks** |

---

## 🎯 Success Criteria

MVP is complete when:

- ✅ All tasks in this list are done
- ✅ Dashboard is fully functional
- ✅ API key auth working on all endpoints
- ✅ Rate limiting working
- ✅ AIBBAR events recording
- ✅ Load test passes (10k events/min)
- ✅ Zero critical bugs
- ✅ Documentation complete
- ✅ Pitch deck ready
- ✅ Demo video ready

---

## 📞 Execution Notes

**Team Structure (Suggested):**
- 1 Backend Developer (Gateway, APIs, Database)
- 1 Full-Stack Developer (Dashboard)
- 1 DevOps Engineer (Deployment, CI/CD)
- 1 Product/Docs Person (Documentation, Pitch)

**Weekly Sync:**
- Monday: Sprint planning
- Wednesday: Mid-week check-in
- Friday: Sprint review + demo

**Deployment Strategy:**
- Daily deploys to staging
- Weekly deploys to production (after validation)
- Rollback plan for each deployment

---

**Last Updated:** December 13, 2025  
**Version:** 1.0.0 (MVP Roadmap)  
**Status:** 🟡 Ready to Execute

---

## ✨ Next Steps

1. **Assign team** to tasks based on skill
2. **Create GitHub Project Board** from this document
3. **Schedule weekly syncs** to track progress
4. **Start with Week 1-2** (Security & Auth)
5. **Report progress** every Friday
6. **Adjust timeline** as needed based on blockers

**Target Investor Pitch:** Week 11-12 after MVP completion 🚀
