# 🌍 GAPIN - Global Artificial Protection & Intelligence Network

**Status:** Foundation Complete (Phase 1) ✅ | MVP in Progress (Phase 2) 🚀  
**Last Updated:** December 14, 2025  
**Repository:** [vyncefounders-code/Gapin](https://github.com/vyncefounders-code/Gapin)

---

## 🎯 What is GAPIN?

**GAPIN** is a world-scale, open-source infrastructure for **AI safety, disaster protection, and global intelligence sharing**.

Powered by:
- 🛡️ **AIBBAR** — AI Black Box Activity Recorder (transparency layer for AI systems)
- 📊 **Event Streaming** — Kafka-powered event backbone
- 🔐 **Cryptographic Audit Trails** — Immutable, signed event logs
- 🌐 **Multi-tenant Support** — Global scale, organization-level isolation
- ⚡ **Ultra-fast Gateway** — Fastify + Redpanda for millions of events/sec

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- **Docker** (for services)
- **Node.js 18+** (for development)
- **Git** (for version control)

### Run Locally

```bash
# 1. Clone repository
git clone https://github.com/vyncefounders-code/Gapin.git
cd Gapin

# 2. Install dependencies
npm install --workspaces

# 3. Start services (Docker Compose)
docker compose -f infra/docker-compose.yml up -d

# 4. Initialize database
cd packages/gateway
npm run db:init

# 5. Start gateway
npm run dev
```

**Gateway Running At:** `http://localhost:3000`

### Test It

```bash
# Health check
curl http://localhost:3000/health

# Publish event
curl -X POST http://localhost:3000/events/publish \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "test.event",
    "message": {"user_id": "123", "action": "login"}
  }'

# Read events
curl http://localhost:3000/events/read
```

---

## 📚 Documentation

All documentation is organized in `/docs`:

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [📖 **INDEX.md**](docs/INDEX.md) | Documentation map + quick links | 5 min |
| [📊 **PROJECT_SUMMARY.md**](docs/PROJECT_SUMMARY.md) | Executive overview + vision | 10 min |
| [🏗️ **SYSTEM_ARCHITECTURE.md**](docs/architecture/SYSTEM_ARCHITECTURE.md) | Complete technical documentation | 45 min |
| [🎯 **MVP_EXECUTION_PLAN.md**](docs/roadmap/MVP_EXECUTION_PLAN.md) | Detailed tasks for MVP completion | 30 min |
| [📝 **GETTING_STARTED.md**](docs/guides/README_GETTING_STARTED.md) | Step-by-step setup guide | 10 min |
| [📈 **2025-12-13-progress.md**](docs/progress/2025-12-13-progress.md) | Latest progress update | 5 min |

**→ Start with [docs/INDEX.md](docs/INDEX.md)**

---

## 🏛️ Project Structure

```
Gapin/
├── docs/                          # 📚 All documentation
│   ├── INDEX.md                   # Documentation navigation
│   ├── PROJECT_SUMMARY.md         # Executive summary
│   ├── architecture/              # Technical design
│   │   └── SYSTEM_ARCHITECTURE.md
│   ├── guides/                    # How-to guides
│   │   └── README_GETTING_STARTED.md
│   ├── roadmap/                   # Planning & tasks
│   │   └── MVP_EXECUTION_PLAN.md
│   └── progress/                  # Development progress
│       ├── 2025-12-13-progress.md
│       └── 2025-12-13-code-review-summary.md
│
├── packages/
│   ├── gateway/                   # 🚀 Fastify API Gateway
│   │   ├── src/
│   │   │   ├── index.ts           # Main server
│   │   │   ├── routes/            # API endpoints
│   │   │   ├── controllers/       # Business logic
│   │   │   ├── events/            # Kafka producer/consumer
│   │   │   └── db/                # Database client
│   │   ├── scripts/               # Utilities
│   │   └── package.json
│   │
│   ├── sdk-js/                    # 📦 JavaScript SDK
│   │   ├── src/
│   │   │   └── index.ts           # Client library
│   │   └── package.json
│   │
│   └── sdk-python/                # 🐍 Python SDK
│       ├── src/
│       │   └── gapin_sdk/
│       │       └── __init__.py
│       └── pyproject.toml
│
├── infra/                         # 🐳 Infrastructure
│   └── docker-compose.yml         # Local dev stack
│
├── bootstrap.sh                   # Unix/Mac setup script
├── bootstrap.ps1                  # Windows setup script
├── package.json                   # Workspace root
└── README.md                      # This file
```

---

## 🔧 What's Implemented

### ✅ Phase 1: Foundation (Complete)

- ✅ **Fastify Gateway** — Event publishing, reading, health checks
- ✅ **Kafka Streaming** — Producer/consumer with proper lifecycle
- ✅ **PostgreSQL Storage** — Event persistence with indexes
- ✅ **JavaScript SDK** — TypeScript-first client library
- ✅ **Python SDK** — Full-featured SDK with async support
- ✅ **Input Validation** — Payload validation on all endpoints
- ✅ **Error Handling** — Structured logging with context
- ✅ **Graceful Shutdown** — Clean resource cleanup on signals
- ✅ **Database Migrations** — Schema versioning
- ✅ **Cross-platform Support** — Windows + Unix

**Compilation:** 0 TypeScript errors (strict mode)

---

### 🟡 Phase 2: MVP Features (In Progress)

- 🟡 **API Key Authentication** — Secure API key generation & validation
- 🟡 **Rate Limiting** — Per-key request limits
- 🟡 **AIBBAR Schema** — Event format for AI activity recording
- 🟡 **Developer Dashboard** — Next.js UI for management
- 🟡 **Metrics & Monitoring** — Prometheus + Grafana
- 🟡 **Multi-tenant Support** — Organization-level isolation

**Timeline:** 8-10 weeks

---

### ⚪ Phase 3: AI Features (Planned)

- ⚪ **AI Workflow Engine** — Node-based AI automation
- ⚪ **LLM Integration** — OpenAI, Anthropic, local models
- ⚪ **Decision Recording** — Full AI decision audit trails
- ⚪ **Compliance APIs** — Government audit support

---

## 🛠️ Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Gateway** | Fastify | 4.28.1 | Ultra-fast HTTP server |
| **Streaming** | Redpanda | v23.3.6 | Kafka-compatible event broker |
| **Database** | PostgreSQL | 15 | Durable event storage |
| **Queue** | KafkaJS | 2.2.4 | Kafka client library |
| **Language** | TypeScript | 5.4.5 | Type-safe development |
| **SDK-JS** | Node.js | 18+ | JavaScript runtime |
| **SDK-Python** | Python | 3.9+ | Python runtime |
| **Containerization** | Docker | Latest | Local development |

---

## 🚀 Usage Examples

### JavaScript SDK

```typescript
import { Client, generateId } from '@gapin/sdk-js';

const client = new Client('http://localhost:3000');

// Publish event
await client.publishEvent('user.signup', {
  user_id: generateId(),
  email: 'user@example.com',
  timestamp: new Date().toISOString()
});

// Read events
const events = await client.readEvents();
console.log(events);
```

### Python SDK

```python
from gapin_sdk import Client, generate_id

client = Client('http://localhost:3000')

# Publish event
client.publish_event('user.signup', {
    'user_id': generate_id(),
    'email': 'user@example.com'
})

# Read events
events = client.read_events()
print(events)
```

### HTTP API

```bash
# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice Johnson"
  }'

# Get user
curl http://localhost:3000/users/1

# List users
curl http://localhost:3000/users
```

---

## 📊 API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/health` | GET | System health check | ✅ Ready |
| `/events/publish` | POST | Publish event to Kafka | ✅ Ready |
| `/events/read` | GET | Read events from database | ✅ Ready |
| `/users` | POST | Create user | ✅ Ready |
| `/users/:id` | GET | Get user by ID | ✅ Ready |
| `/users` | GET | List all users | ✅ Ready |
| `/api/keys` | POST | Generate API key | 🟡 Phase 2 |
| `/api/keys` | GET | List API keys | 🟡 Phase 2 |
| `/metrics` | GET | Prometheus metrics | 🟡 Phase 2 |

**Full API Reference:** [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md#api-reference)

---

## 📈 Performance Characteristics

- **Throughput:** 10k+ events/sec (single node)
- **Latency:** <100ms p95 for publish
- **Scalability:** Horizontal scaling via Kafka partitions
- **Storage:** 30-day event retention (configurable)
- **Availability:** High-availability Redpanda cluster (production)

---

## 🔐 Security

- **Event Integrity:** HMAC-SHA256 signatures (Phase 2)
- **API Authentication:** API key validation (Phase 2)
- **Transport:** TLS/HTTPS in production
- **Audit Logging:** Full activity trails for compliance
- **Multi-tenancy:** Organization-level data isolation

---

## 🤝 Contributing

### Development Setup

```bash
# Install dependencies
npm install --workspaces

# Run linter
npm run lint --workspace=@gapin/gateway

# Run tests
npm run test --workspace=@gapin/gateway

# Build all packages
npm run build --workspaces
```

### Pull Request Process

1. Create feature branch: `git checkout -b feat/feature-name`
2. Make changes and test locally
3. Push to GitHub: `git push origin feat/feature-name`
4. Create pull request with clear description
5. Wait for CI/CD to pass
6. Request review from maintainers
7. Merge after approval

### Code Style

- **TypeScript:** Strict mode enabled, ESLint configured
- **Formatting:** Prettier for code formatting
- **Commits:** Conventional commits (feat:, fix:, docs:, etc.)

---

## 📞 Support & Questions

- **Documentation:** [docs/INDEX.md](docs/INDEX.md)
- **Issues:** [GitHub Issues](https://github.com/vyncefounders-code/Gapin/issues)
- **Architecture Questions:** See [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)
- **Getting Started:** See [docs/guides/README_GETTING_STARTED.md](docs/guides/README_GETTING_STARTED.md)

---

## 📜 License

**GAPIN** is open source under the MIT License.

See [LICENSE](LICENSE) for details.

---

## 🎯 Mission

**GAPIN** exists to protect humanity from AI misuse and global threats through:

1. **🛡️ AI Safety** — AIBBAR records everything AI systems do
2. **🔍 Threat Detection** — Real-time anomaly detection
3. **🌐 Global Coordination** — Emergency response networks
4. **📊 Intelligence Sharing** — Real-time threat data
5. **🏛️ Government Certification** — AI compliance framework

Every AI system should be transparent. Every threat should be detectable. Every response should be coordinated.

**That's GAPIN.**

---

**Status:** 🟢 Phase 1 Complete | 🟡 Phase 2 In Progress | ⏱️ MVP Ready in 8 weeks

Join us in building the future of AI safety. [Get Started](docs/guides/README_GETTING_STARTED.md)
