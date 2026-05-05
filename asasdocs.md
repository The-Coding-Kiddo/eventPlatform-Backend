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

## 🚀 Future Roadmap
- **Phase 7:** Healthcheck API (Terminus) for Kubernetes/Container orchestration.
- **Phase 8:** Automated Test Suite (Jest & Supertest) for regression prevention.
