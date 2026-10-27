# AI-Powered Conference Management Platform
[![CI](https://github.[STRIPPED 71 bytes].yml/badge.svg)](https://github.com/Rowland2023/conference-management-llm-platform/actions/workflows/ci.yml) [![Node 22](https://img.shields.io/badge/Node-22-green)]() [![Tests 113](https://img.shields.io/badge/tests-113-blue)]() [![Coverage Gate](https://img.shields.io/badge/coverage-50%2F70%2F60%2F60-orange)]()

> Event-Driven Backend · Accounting Workflows · Controlled AI Tool Execution · Transactional Outbox

Production-ready conference management backend with modular DDD, PostgreSQL, Redis, Kafka, and LLM tool-calling via validated, authorized execution.

**Core principle:** LLM proposes → Backend validates, authorizes, confirms → Use-case executes.

## Overview
Handles interconnected workflows: events, registrations, tickets, payments, invoices, refunds, ledger, settlement, tax. Built for reliability: domain rules enforced, state transitions transactional, async events via outbox, financial ops idempotent.

## Key Features
- **Modular DDD:** `event-schedule`, `registration`, `ticket`, `accounting-services/{invoice,payment,refund,ledger,settlement,tax}`, `authentication`
- **Event-Driven Reliability:** Transactional outbox (persist business + event same TX), Kafka dispatcher, Redis streams, retry + dedup, idempotent consumers
- **Financial Integrity:** Ledger accounts, journal entries, holds, invoice lifecycle, Paystack integration, idempotency keys, webhook signature verification, double-entry constraints
- **AI Assistant:** OpenAI function-calling with ToolRegistry (schema validation, role filtering, confirmation-required actions, ownership checks, re-validation before execution)
- **Operational:** Health `GET /health`, Pino structured logging, OpenTelemetry tracing, correlation-id, Knex migrations, Docker Compose, Jest 113 tests, ESLint flat config, Autocannon benchmarks

## Architecture
