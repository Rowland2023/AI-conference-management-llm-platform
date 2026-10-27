# Conference Management Platform

A Node.js backend for conference operations, built with modular domain-driven design, PostgreSQL persistence, event-driven integration, and AI-assisted workflows.

## Technology Stack

- **Runtime/API:** Node.js 22, Express
- **Persistence:** PostgreSQL, Knex.js migrations
- **Messaging and caching:** Kafka, Redis
- **Observability:** Pino
- **AI integration:** OpenAI tool calling with validated tool schemas and authorization checks
- **Testing:** Jest
- **Performance testing:** Autocannon
- **Infrastructure:** Docker Compose
- **Code quality:** ESLint flat configuration

## Architecture

The application separates business logic from infrastructure using domain, application, and infrastructure layers.

Core bounded contexts include:

- **Event scheduling:** Event management and scheduling workflows.
- **Registration:** Conference attendee registration.
- **Ticketing:** Ticket-related workflows.
- **Accounting services:** Payment-related operations, ledger accounts, journal entries, and holds.

Shared infrastructure supports database access, dependency injection, messaging, logging, and event publication.

The accounting implementation includes domain aggregates, repositories, mappers, and a transactional-outbox design. The AI integration uses tool definitions and validation, with authorization and confirmation controls for supported state-changing operations.

## Getting Started

### Prerequisites

- Node.js 22
- npm
- Docker Desktop with Docker Compose

### Installation

```bash
npm ci
```

Create your local environment file:

```bash
cp .env.example .env
```

Configure the required environment variables. Never commit secrets or your local `.env` file.

Start the infrastructure:

```bash
docker compose up -d
```

Run database migrations using the migration command configured by this repository, then start the application:

```bash
npm start
```

Check the application's health endpoint:

```bash
curl http://localhost:3000/health
```

> Verify the configured port, migration command, required environment variables, and service readiness against the current repository before following these instructions.

## Testing

Run the project's configured test suite:

```bash
npm test
```

The repository has reported 113 Jest tests; use the results from a fresh test run as the authoritative passing count.

For isolated unit tests, use the repository's unit-test script if configured.

## Performance Benchmark

A local Autocannon run reported approximately **3,561 requests per second at 25 concurrent connections**.

This figure is a benchmark observation, not a general throughput guarantee. Record the tested endpoint, test duration, latency percentiles, error count, hardware, and whether request pipelining was enabled so the result can be reproduced and interpreted correctly.

## Engineering Focus

- Explicit domain boundaries and business invariants
- Repository and unit-of-work patterns
- Transactional persistence and event publication
- Tenant-aware access patterns
- Idempotency and safe handling of state-changing operations
- Automated tests for application behavior
- Validated AI tool execution with authorization controls

## Author

**Rowland Obi**

- GitHub: https://github.com/Rowland2023
- LinkedIn: https://www.linkedin.com/in/rowland-obi-122878281/
