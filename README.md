# AI-Powered Conference Management Platform
### Event-Driven Backend · Accounting Workflows · Controlled AI Tool Execution

An event-driven backend for conference scheduling, registrations, ticketing, and accounting workflows, built with **Node.js, Express, PostgreSQL, Redis, and Kafka**.

The platform combines modular domain-driven design with asynchronous event processing and an AI assistant that interacts with application capabilities through validated tools and controlled execution.

**Core principle:** The LLM proposes an action. The backend validates, authorizes, and controls its execution.

> **Project status:** Active development. Test results and benchmarks below describe recorded local development runs, not production guarantees.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Event-Driven Reliability](#event-driven-reliability)
- [AI Assistant](#ai-assistant)
- [Technology Stack](#technology-stack)
- [API Overview](#api-overview)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Testing](#testing)
- [Performance Benchmark](#performance-benchmark)
- [Security and Reliability](#security-and-reliability)
- [Roadmap](#roadmap)
- [License](#license)

## Overview

Conference management involves interconnected workflows for events, registrations, tickets, payments, and accounting. A reliable backend must enforce business rules, protect persisted state, coordinate asynchronous processing, and handle external-service failures.

This project explores these challenges through a modular backend and an AI-assisted interface for supported conference operations.

The engineering focus includes:

- **Domain-driven modularity:** Separate business responsibilities into feature modules.
- **Event-driven processing:** Kafka integration and outbox-based event publication.
- **Financial workflows:** Accounting components and payment-related operations.
- **Data integrity:** Transaction boundaries and controlled state transitions.
- **AI-assisted operations:** Schema-validated tools with authorization and confirmation controls for supported actions.
- **Operational foundations:** Structured logging, automated tests, containerized dependencies, and load testing.

The goal is to demonstrate backend engineering practices relevant to fintech, payments, and distributed systems.

## Key Features

### Modular domain architecture

The application separates functionality into bounded feature areas:

- `event-schedule`
- `registration`
- `ticket`
- `accounting-services`

Shared infrastructure provides database access, logging, messaging, AI integration, and application composition.

### Accounting and payment-related workflows

The accounting area includes components for:

- Ledger accounts and journal-entry functionality.
- Holds and payment-related state transitions.
- Invoice lifecycle management.
- Refund workflows.
- Tax-related functionality.
- Payment-provider integration points.

The completeness and financial invariants of individual workflows should be evaluated against their implementations and tests.

### Event-driven infrastructure

The platform includes infrastructure for Kafka connectivity, event publication, outbox persistence and dispatch, background processing, and Redis-backed workflows.

The design considers retry handling, duplicate delivery, and separation between business-state persistence and asynchronous event publication.

### AI-assisted conference operations

The assistant uses application-defined tools to interact with supported conference operations, including:

- Creating events.
- Retrieving events.
- Listing events.
- Rescheduling events.
- Cancelling events.

The tools exposed to a particular request depend on the current registry, permissions, feature configuration, and implementation.

### Operational foundations

- HTTP health endpoint: `GET /health`
- Structured logging with Pino.
- Environment-based configuration.
- Jest automated tests.
- Docker Compose local infrastructure.
- Autocannon HTTP load testing.

## Architecture

The application uses a modular backend structure. A composition root assembles shared infrastructure, feature modules, routes, and application lifecycle behavior.

### Simplified project structure

```text
conference-management/
├── src/
│   ├── app.js
│   ├── index.js
│   ├── boostrap/
│   │   ├── infrastructure.js
│   │   ├── modules.js
│   │   ├── routes.js
│   │   └── lifecycle.js
│   ├── config/
│   ├── cross-cutting/
│   │   ├── database/
│   │   └── logging/
│   ├── Shared/
│   │   └── Infrastructure/
│   │       └── ai/
│   └── conference-management/
│       ├── event-schedule/
│       ├── registration/
│       ├── ticket/
│       └── accounting-services/
├── test/
├── docker-compose.yml
├── package.json
└── README.md
```

This is a simplified overview; consult the current checkout for the complete structure.

### Request lifecycle

```text
HTTP Request
     |
     v
Express Middleware
     |
     v
Route Handler
     |
     v
Application Service / Use Case
     |
     v
Domain Rules
     |
     v
Repository / Database Transaction
     |
     +----> Outbox Event
                  |
                  v
             Kafka Worker
                  |
                  v
             Event Consumer
```

Application services coordinate business operations, while infrastructure adapters handle persistence, messaging, and external dependencies.

## Event-Driven Reliability

### Transactional outbox

Publishing a message separately from committing a database transaction creates a dual-write problem. The database operation could succeed while event publication fails, leaving downstream consumers unaware of the change.

The transactional outbox pattern addresses this risk by recording the business update and its corresponding event in the same database transaction.

```text
1. Receive business command
          |
          v
2. Begin database transaction
          |
          v
3. Persist business state
          |
          v
4. Persist outbox event
          |
          v
5. Commit transaction
          |
          v
6. Outbox worker publishes event
          |
          v
7. Consumer processes event
```

Key engineering considerations include:

- Retrying failed event publication.
- Handling duplicate event delivery.
- Tracking publication status.
- Making consumers safe under retries.
- Preserving required event ordering.
- Recovering after worker or broker failures.

The outbox provides a foundation for reliable event publication. End-to-end guarantees depend on the actual transaction boundaries, worker implementation, and consumer behavior.

### Idempotency and financial operations

Payment-related systems must handle retries without accidentally creating duplicate financial effects.

Important safeguards include:

- Stable idempotency keys for retried operations.
- Database constraints protecting unique business operations.
- Explicit handling of ambiguous provider responses.
- Webhook signature verification and event deduplication.
- Atomic persistence of related financial state.
- Auditable payment and refund state transitions.

These guarantees must be verified at the relevant operation boundaries.

## AI Assistant

The AI integration separates language-model output from application business logic through controlled tool execution.

### Execution flow

```text
User Request
     |
     v
AI Assistant / LLM
     |
     v
Tool Selection
     |
     v
Tool Name and Argument Validation
     |
     v
Authorization and Feature Checks
     |
     v
Confirmation Required?
     |
     +---- Yes ----> Explicit Confirmation
     |                       |
     |                       v
     |               Revalidate and Reauthorize
     |                       |
     +-----------------------+
                             |
                             v
                    Application Use Case
                             |
                             v
                      Result or Error
```

### Tool registry and validation

The tool registry defines which application operations the assistant can invoke. Its responsibilities include:

- Defining tool metadata and input schemas.
- Detecting invalid or duplicate definitions.
- Filtering tools by applicable roles and feature configuration.
- Validating arguments before execution.
- Applying confirmation requirements to designated state-changing actions.

### Controlled state changes

For supported confirmation-required actions, proposing an operation is separate from executing it.

Before execution, the application should verify the pending action, user ownership, tenant context where applicable, current permissions, and validated arguments. Confirmation must not bypass normal business rules or application-level authorization.

This approach reduces the risk of treating an LLM-generated tool call as trusted application code. It does not eliminate the need for authorization checks, transaction safety, idempotency, or security testing.

## Technology Stack

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Language | JavaScript with ES modules |
| HTTP framework | Express |
| Relational database | PostgreSQL |
| Query builder | Knex |
| Cache and supporting infrastructure | Redis |
| Event messaging | Apache Kafka |
| Logging | Pino |
| AI integration | OpenAI API |
| Schema validation | Zod |
| Automated testing | Jest |
| Load testing | Autocannon |
| Local infrastructure | Docker Compose |

## API Overview

The following routes are entry points identified during development. Verify the current route registration and request schemas before relying on specific paths or operations.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Basic application health response |
| `/api/v1/events` | Event-schedule routes, subject to current registration |
| `/api/v1/registrations` | Registration routes, subject to current registration |
| `/tickets` | Ticket routes, subject to current registration |
| `POST /api/v1/assistant/chat` | AI assistant chat workflow |
| `POST /api/v1/assistant/confirm` | AI action confirmation workflow |

Authentication, request payloads, and supported operations depend on the corresponding route definitions and middleware.

### Health endpoint

The health endpoint returns a JSON response similar to:

```json
{
  "status": "ok",
  "service": "conference-management",
  "timestamp": "2026-10-22T00:00:00.000Z"
}
```

The timestamp is illustrative and generated dynamically.

**Health-check limitation:** A successful response confirms that the HTTP health route is responding. It does not independently prove that PostgreSQL, Redis, Kafka, payment integrations, or all business workflows are healthy.

## Getting Started

### Prerequisites

- Node.js compatible with the project; Node.js 22 has been used during development.
- npm.
- Git.
- Docker Desktop with Docker Compose.
- Credentials for any external integrations you intend to use.

### 1. Clone the repository

```bash
git clone https://github.com/Rowland2023/conference-management.git
cd conference-management
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start supporting services

```bash
docker compose up -d
docker compose ps
```

Inspect logs if a service fails to start:

```bash
docker compose logs --tail=100
```

Use the repository's Docker Compose configuration as the source of truth for service names, port mappings, and local credentials.

### 4. Configure environment variables

Create a local `.env` file using the configuration module and Compose configuration as references.

Example database settings:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=5434
DB_NAME=conference_management
DB_USER=conference
DB_PASSWORD=replace_with_your_local_database_password
DB_SSL=false
```

These are example values, not guaranteed defaults. Verify the actual port mapping, database name, and credential requirements in your checkout.

Configure any additional Redis, Kafka, payment-provider, and AI settings required by the modules you enable.

**Never commit real credentials to Git.** Keep `.env` local and maintain a sanitized `.env.example` for other developers.

The refund-related module has required `PAYSTACK_SECRET_KEY` during startup in the development setup. A placeholder may satisfy a configuration check, but it is not a valid credential and must not be used for real payment or refund requests.

### 5. Run database migrations

If the project defines a migration script, run the command specified in `package.json` before starting the application.

For example, if `migrate` is an available script:

```bash
npm run migrate
```

Check the actual scripts before running this step.

### 6. Start the application

Use the start command defined in `package.json`. If the project provides a `start` script:

```bash
npm start
```

In Windows PowerShell:

```powershell
npm.cmd start
```

Wait for the application to report that the HTTP server is listening.

### 7. Verify the health endpoint

```bash
curl http://localhost:3000/health
```

Or in PowerShell:

```powershell
Invoke-WebRequest http://localhost:3000/health -TimeoutSec 5
```

A successful local check should return HTTP `200` with the health response.

## Environment Configuration

The following variables are relevant to the current development configuration. Verify the complete list in `src/config/index.js` and the infrastructure bootstrap code.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP server port |
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `DB_NAME` | Application database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_SSL` | Database SSL configuration |
| `PAYSTACK_SECRET_KEY` | Paystack integration credential |

Additional settings may be required for Redis, Kafka, AI, and other enabled integrations.

Use test credentials where supported. Never use placeholder secrets to perform real payment operations.

## Testing

Run the configured test suite:

```bash
npm test
```

The existing test script sets `NODE_ENV=test` and supplies a dummy Paystack key to satisfy a startup configuration requirement. This does not make the credential valid for external payment requests.

For focused AI tool-registry testing, where the configuration and path exist:

```powershell
npx.cmd jest --config jest.unit.config.cjs --runInBand --runTestsByPath test/unit/ai/ToolRegistry.test.js
```

### Latest recorded test run

A recorded full Jest run reported:

- **12 test suites passed**
- **76 tests passed**
- A warning that Jest did not exit promptly after the test run completed.

These figures describe that recorded run, not a guarantee that every checkout passes. Investigate the outstanding asynchronous-handle warning with `--detectOpenHandles`.

Before considering the project production-ready, validate:

- Unit and integration tests.
- API authentication, authorization, and input validation.
- AI tool authorization and confirmation flows.
- Database transaction boundaries.
- Outbox retries and duplicate event delivery.
- Payment-provider timeouts, retries, and webhook handling.
- Graceful startup and shutdown.
- Recovery from dependency outages.

## Performance Benchmark

### Scope and environment

Local load tests were performed with Autocannon against:

```text
GET http://localhost:3000/health
```

Each run lasted approximately 30 seconds, using HTTP pipelining factor `-p 1`. The four configurations used the same endpoint and test settings.

The health endpoint returns a small JSON response. These results measure the HTTP health route under local development conditions—not database-backed business workflows or production capacity.

### Results

| Concurrent connections | Duration | Pipeline factor | Total requests | Average requests/sec | Average latency | p99 latency | Max latency |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | ~30 s | 1 | ~99k | 3,309.5 | 2.50 ms | 15 ms | 143 ms |
| 25 | ~30 s | 1 | ~107k | 3,561.0 | 6.52 ms | 34 ms | 166 ms |
| 50 | ~30 s | 1 | ~106k | 3,531.87 | 13.66 ms | 77 ms | 296 ms |
| 100 | ~30 s | 1 | ~105k | 3,488.07 | 28.20 ms | 150 ms | 591 ms |

Results are taken from individual Autocannon runs and rounded for readability. They have not been averaged across repeated trials.

### Interpretation

**Throughput**

The highest observed average throughput was approximately **3,561 requests per second at 25 concurrent connections**. Throughput remained within approximately 3,300–3,560 requests per second across the four configurations.

Increasing concurrency beyond 25 connections did not produce a corresponding increase in throughput in these runs.

**Latency**

Average and tail latency increased as concurrency rose:

- **10 connections:** 2.50 ms average latency; 15 ms p99.
- **25 connections:** 6.52 ms average latency; 34 ms p99.
- **50 connections:** 13.66 ms average latency; 77 ms p99.
- **100 connections:** 28.20 ms average latency; 150 ms p99.

These observations indicate that higher concurrency increased response latency without materially improving throughput in these runs. They do not establish the underlying cause.

### Reproducing the benchmark

Run the following commands against the same running application:

```bash
npx autocannon -c 10 -d 30 -p 1 http://localhost:3000/health
npx autocannon -c 25 -d 30 -p 1 http://localhost:3000/health
npx autocannon -c 50 -d 30 -p 1 http://localhost:3000/health
npx autocannon -c 100 -d 30 -p 1 http://localhost:3000/health
```

- `-c`: concurrent connections.
- `-d`: test duration in seconds.
- `-p`: HTTP pipelining factor.

For more reliable comparisons, repeat each configuration several times under consistent conditions. Record the operating system, Node.js version, hardware, dependency state, and background load.

### Limitations and next steps

The captured benchmark output did not include an explicit error or timeout summary, and HTTP status codes were not independently collected. These measurements therefore should not be interpreted as proof that every request succeeded.

This benchmark does not establish:

- Maximum production capacity.
- Database query throughput.
- Registration or ticket-purchase capacity.
- Payment or refund throughput.
- Kafka consumer throughput.
- Production availability or latency guarantees.

The next performance milestone is to benchmark representative database-backed read and write endpoints using valid test data and appropriate authentication. Measure throughput, latency percentiles, HTTP error rates, and business-data correctness.

## Security and Reliability

Important implementation and verification areas include:

- Validate input at HTTP and AI tool boundaries.
- Enforce authorization within application operations, not only in the assistant.
- Use database transactions for operations requiring atomic state changes.
- Apply idempotency to retried operations where duplicate execution would be harmful.
- Verify webhook authenticity and deduplicate provider events.
- Make outbox workers and Kafka consumers safe under retries and duplicate delivery.
- Keep secrets outside source control and rotate credentials appropriately.
- Avoid logging tokens, payment credentials, or sensitive personal information.
- Test graceful shutdown and recovery from dependency outages.
- Add dependency-aware readiness checks, metrics, and tracing as needed.

The presence of an architectural component or supporting library does not, by itself, prove that every security or reliability guarantee is implemented end to end.

## Roadmap

- [ ] Document required environment variables in `.env.example`.
- [ ] Standardize API response and error formats.
- [ ] Expand integration and regression test coverage.
- [ ] Investigate the outstanding Jest asynchronous-handle warning.
- [ ] Test outbox recovery and consumer idempotency under simulated failures.
- [ ] Verify payment-provider timeout, retry, and webhook behavior.
- [ ] Add dependency-aware readiness checks.
- [ ] Repeat benchmarks and record system details.
- [ ] Benchmark database-backed read and write operations.
- [ ] Document AI tool permissions, confirmation requirements, and failure handling.
- [ ] Validate deployment, monitoring, and secret-management procedures.

## License

The repository's actual `LICENSE` file determines the applicable license. If the project is intended to use the MIT License, add a valid MIT `LICENSE` file before describing the project as MIT-licensed.
