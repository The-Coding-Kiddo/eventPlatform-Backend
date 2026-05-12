# 🏗️ EventPlatform Enterprise Architecture Documentation

This document serves as the technical blueprint for the architectural elevation of the EventPlatform backend. It details the transition from a monolithic "rookie" codebase to a decoupled, secure, and observable enterprise system.

---

## 🛡️ Phase 1: Declarative Security (RBAC)
**Goal:** Replace manual imperative checks with a centralized, metadata-driven authorization engine.

### Technical Implementation
- **Custom Decorators:** Created a `@Roles(...role: Role[])` decorator using the `Reflector` API to attach permission metadata to route handlers.
- **Global Auth Guard:** Implemented a `RolesGuard` that intercepts every request. It extracts metadata via `this.reflector.get<Role[]>('roles', context.getHandler())` and compares it against the `decoded.role` in the JWT payload.
- **Controller Decoupling:** Stripped `EventsController`, `AdminController`, and `NotificationsController` of `if/else` role logic, making them "pure" business logic handlers.

### Enterprise Benefits
- **Auditability:** Security posture is visible at the code level via decorators.
- **DRY Principle:** Security logic is written once and applied universally.

---

## 📋 Phase 2: Standardized API Protocol
**Goal:** Enforce a strict contract between Frontend and Backend using the "Envelope Pattern."

### Technical Implementation
- **Transform Interceptor:** Leverages RXJS `map` operator within a NestJS `NestInterceptor`. Every outgoing response is wrapped in a `Response<T>` interface: `{ success: true, data: T, timestamp: string }`.
- **Global Exception Filter:** Implemented a `@Catch()` filter that overrides the default NestJS error handler. It catches `HttpException` and raw `Error` objects, sanitizing them into a consistent structure to prevent "Ugly Errors" and internal stack trace leakage.

### Enterprise Benefits
- **Frontend Predictability:** The client-side team consumes a stable contract, reducing "undefined" errors.
- **Security:** Prevents leaking database schema or internal logic via raw error messages.

---

## 👁️ Phase 3: High-Fidelity Observability
**Goal:** Moving from `console.log` to structured, searchable, and persistent telemetry.

### Technical Implementation
- **Winston Integration:** Integrated `nest-winston` as the primary logging driver.
- **Environment-Aware Transports:**
  - **Development:** Uses `nestLike` formatting with ANSI colors and timestamps for readability.
  - **Production:** Configured for `json()` format to support automated ingestion into ELK stacks or CloudWatch.
- **Global Injection:** Replaced the default `LoggerService` in `main.ts` so that framework-level events (Bootstrap, Routes mapping) are also captured.

### Enterprise Benefits
- **Searchability:** JSON logs allow dev-ops to filter logs by `requestId` or `level` instantly.
- **Accountability:** Every system event is timestamped and categorized.

---

## ⚖️ Phase 4: Scalability & Resource Management
**Goal:** Prevent memory exhaustion and database lock-ups during high-traffic discovery.

### Technical Implementation
- **Pagination DTO:** Created a reusable `PaginationDto` with `Type` transformation to ensure `skip` and `take` are cast to integers.
- **Prisma Optimization:** Updated service methods to use Prisma's `skip` (offset) and `take` (limit) parameters.
- **Atomic Counts:** Every list query is now a `Promise.all` execution that returns both the data slice and the total record count for frontend pagination UI.

### Enterprise Benefits
- **Performance:** Constant-time response regardless of total database size.
- **Bandwidth:** Drastic reduction in payload size for mobile and web clients.

---

## 🛡️ Phase 5: Adaptive Rate Limiting
**Goal:** Mitigating brute-force attacks and resource abuse at the network edge.

### Technical Implementation
- **Throttler Guard:** Integrated `@nestjs/throttler` as a global guard in `AppModule`.
- **Dynamic Limits:** Set a global baseline of 60 requests per minute (TTL: 60s).
- **Security Headers:** Automatically adds `X-RateLimit-Limit` and `X-RateLimit-Remaining` to responses, allowing the frontend to proactively slow down requests.

---

## 👥 Phase 6: Logistics & Data Access (Attendee Management)
**Goal:** Empowering institution admins with secure access to participant manifests.

### Technical Implementation
- **Scoped Relationship Fetching:** Added `getAttendees` method using Prisma's relation selection. It fetches the `User[]` array connected to an `Event`.
- **Permission Scoping:** Implemented cross-check logic: `if (role !== 'super_admin' && event.institution !== institution)`. This ensures multi-tenant isolation where one institution cannot view another's private data.

---

## 🏥 Phase 7: Healthcheck API (Container Orchestration)
**Goal:** Expose a machine-readable liveness/readiness probe for Docker and Kubernetes orchestration.

### Technical Implementation
- **Terminus Integration:** Installed `@nestjs/terminus` and created a dedicated `HealthModule`.
- **Custom `PrismaHealthIndicator`:** Extends `HealthIndicator` and pings the database with `SELECT 1` via `prisma.$queryRaw`. Returns a structured `HealthIndicatorResult`; throws `HealthCheckError` on failure.
- **Endpoint:** `GET /health` — performs two checks in parallel:
  1. **`database`** — confirms PostgreSQL connectivity via Prisma.
  2. **`memory_heap`** — asserts Node.js heap usage remains below **300 MB**.
- **HTTP Semantics:** Returns `200 OK` when all checks pass; returns `503 Service Unavailable` automatically when any check fails — compatible with Kubernetes liveness and readiness probe configuration.

### File Structure
```
src/health/
  health.module.ts          # Wires TerminusModule + PrismaModule
  health.controller.ts      # GET /health endpoint
  prisma.health.ts          # Custom DB health indicator
```

### Enterprise Benefits
- **Zero-Downtime Deploys:** K8s readiness probe prevents traffic routing to unhealthy pods.
- **Auto-Recovery:** K8s liveness probe restarts containers that become unresponsive.
- **Observability:** Health endpoint becomes the canonical "is the system alive?" source of truth for monitoring tools (Datadog, UptimeRobot, etc.).

---

## 🧪 Phase 8: Automated Test Suite (Regression Prevention)
**Goal:** Establish a comprehensive test harness that catches regressions before they reach production.

### Technical Implementation
- **Unit Tests (Jest + mocked Prisma):** All four service layers are fully covered with isolated tests using `jest.fn()` mocks for `PrismaService`. No real database connection required.
  - `auth.service.spec.ts` — register, login (including password hashing verification), getMe, provision
  - `events.service.spec.ts` — public listing with filters, CRUD permission matrix, atomic registration/cancellation via mocked `$transaction`
  - `admin.service.spec.ts` — moderation queue, approve/reject workflow, analytics aggregation correctness, user/institution management
  - `notifications.service.spec.ts` — direct notifications, role/category fan-out broadcasts, mark-read lifecycle, deletion
- **E2E Tests (SuperTest):** Full HTTP request/response cycle tests against the real NestJS application with an overridden `PrismaService` mock:
  - `GET /health` — liveness probe response shape
  - `POST /auth/register` — success, 409 conflict, 400 validation
  - `POST /auth/login` — 401 on invalid credentials
  - `GET /events` — public listing with query params
  - `GET /events/:id` — 404 when not found
  - Protected route guard verification (401 without JWT)
  - **Envelope contract assertions** — every success response has `{ success, data, timestamp }`, every error has `{ success, statusCode, message }`

### Running Tests
```bash
# Unit tests
npm test

# Unit tests with coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

### Enterprise Benefits
- **Regression Prevention:** Any breaking change to service logic or API contracts is caught immediately.
- **Refactor Confidence:** Developers can safely restructure code knowing the test suite will flag breakage.
- **CI/CD Gate:** Tests serve as the quality gate in automated deployment pipelines.

---

## ⚡ Performance Fix: Analytics Query Optimization
**Goal:** Eliminate the O(n) memory bottleneck in the admin analytics endpoint.

### Problem
The original `getAnalytics()` method called `prisma.event.findMany()` and `prisma.user.findMany()` with no filters, loading **every event and user record into Node.js memory** then filtering in JavaScript. At scale (10k+ events), this causes memory spikes and slow responses.

### Solution
Replaced all in-memory aggregations with **database-level queries**:

| Before | After |
|--------|-------|
| `event.findMany()` → JS filter | `event.count({ where: { status } })` |
| JS `filter().length` for categories | `event.groupBy({ by: ['category'], _count })` |
| JS `sort().slice()` for cities | `event.groupBy({ by: ['location'], orderBy, take: 5 })` |
| JS date comparison for monthly count | `event.count({ where: { createdAt: { gte: startOfMonth } } })` |
| JS Set dedup for institutions | Deduplicated from minimal `findMany({ select: { institution, suspended } })` |

All 9 queries run concurrently via a single `Promise.all([...])`, so total latency equals the slowest individual query rather than their sum.

### Enterprise Benefits
- **Constant-time performance** regardless of dataset size.
- **Dramatically reduced memory pressure** on the Node.js process.
- **Accurate `activeInstitutions` count** — now correctly tracks the `suspended` flag per institution (previously it was always equal to `totalInstitutions`).
