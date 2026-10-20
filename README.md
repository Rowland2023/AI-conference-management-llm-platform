<div align="center">

# 🚀 AI-Powered Conference Management Platform

### **Enterprise Backend • AI Function Calling • Domain-Driven Design • Event-Driven Architecture**

Production-grade backend demonstrating how **Large Language Models (LLMs)** can safely orchestrate business-critical workflows through validated function calling, transactional guarantees, and enterprise architecture.

Built with **Node.js**, **Express**, **PostgreSQL**, **Redis**, and architecture patterns directly transferable to **Python (FastAPI / Django)**.

---

![Node.js](https://img.shields.io/badge/Node.js-22.x-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Redis](https://img.shields.io/badge/Redis-7-red)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![Architecture](https://img.shields.io/badge/Architecture-DDD-purple)
![AI](https://img.shields.io/badge/LLM-Function%20Calling-orange)
![License](https://img.shields.io/badge/License-MIT-success)

</div>

---

# 📖 Overview

Modern AI systems require far more than simply calling an LLM.

They require a secure execution layer capable of translating natural language into validated business workflows **without bypassing authentication, authorization, validation, or transactional guarantees.**

This project demonstrates exactly how to build that layer.

Rather than allowing an LLM to interact directly with databases or backend services, every AI-generated request passes through the **same production pipeline** used by traditional REST APIs.

---

# ✨ Highlights

-  LLM Function Calling
-  AI Tool Registry
- 🔐 JWT Authentication & RBAC
- 📦 Domain-Driven Design (DDD)
- ⚡ Event-Driven Architecture
- 🔄 Transactional Outbox Pattern
-  Optimistic Concurrency Control
- 🗄 PostgreSQL + Redis
- 📈 High-Concurrency Load Tested
- 🐳 Dockerized Development Environment

---

#  AI Workflow Orchestration

### Example Request

> **"Register Sarah Johnson for the AI Conference, reserve a VIP ticket, and send her a confirmation email."**

---

## Step 1 — LLM Generates Structured Tool Calls

```json
[
  {
    "tool": "register_attendee",
    "args": {
      "conference_id": "conf_ai_2026",
      "attendee_name": "Sarah Johnson",
      "ticket_type": "VIP"
    }
  },
  {
    "tool": "send_notification",
    "args": {
      "template": "registration_confirmation"
    }
  }
]
```

---

## Step 2 — Secure Backend Execution

```text
Natural Language

        │
        ▼

OpenAI Function Calling

        │
        ▼

Tool Registry
(JSON Schema Validation)

        │
        ▼

JWT Authentication

        │
        ▼

Role-Based Authorization

        │
        ▼

Application Service

        │
        ▼

Domain Validation

        │
        ▼

Database Transaction

        │
        ▼

Transactional Outbox

        │
        ▼

Kafka / Redis Streams

        │
        ▼

Notification Service

        │
        ▼

Audit Log
```

> **Important:** The AI layer never bypasses business rules. Every AI-generated request follows the exact same authentication, authorization, validation, transaction management, and domain logic as standard API requests.

---

# 📊 Performance Benchmark

Load tested using **Autocannon** under sustained concurrent traffic.

| Metric | Result |
|---------|--------|
| Duration | **30 seconds** |
| Concurrent Connections | **100** |
| Total Requests | **100,178** |
| Throughput | **3,293 req/sec** |
| Success Rate | **100%** |
| Errors | **0** |
| Timeouts | **0** |
| Average Latency | **298 ms** |

**Result:** Stable throughput with zero request failures during concurrent registration and ticketing workloads.

---

# 🏗 Architecture

```
src/

├── config/
│
├── modules/
│   ├── authentication/
│   ├── conference/
│   ├── registration/
│   ├── ticket/
│   ├── payment/
│   ├── notification/
│   └── user/
│
├── shared/
│   ├── application/
│   ├── domain/
│   ├── infrastructure/
│   └── interfaces/
│
├── middleware/
├── routes/
└── app.js
```

Every business module contains:

- Domain
- Application
- Infrastructure
- Presentation

This separation ensures **high cohesion**, **low coupling**, and long-term maintainability.

---

# 🧩 Enterprise Architecture Patterns

## Domain-Driven Design

- Aggregates
- Entities
- Value Objects
- Domain Services
- Repositories
- Domain Events

---

## Transactional Outbox

Aggregate state and domain events are committed atomically.

```text
HTTP Request

↓

Controller

↓

Application Service

↓

Aggregate

↓

Repository

├── Persist Aggregate
├── Persist Domain Events
└── Commit Transaction

↓

Outbox Publisher

↓

Kafka / Redis Streams
```

This eliminates distributed dual-write failures while guaranteeing reliable event delivery.

---

## Optimistic Concurrency Control

```sql
UPDATE tickets
SET version = version + 1
WHERE id = ?
AND version = ?;
```

Prevents lost updates without database locking.

---

## Event-Driven Architecture

Example domain events:

- RegistrationCreated
- TicketReserved
- TicketPurchased
- PaymentSucceeded
- NotificationQueued

---

# 🌐 REST API Example

## Register Attendee

```http
POST /registrations
```

```json
{
  "conferenceId": "11111111-1111-1111-1111-111111111111",
  "attendeeId": "22222222-2222-2222-2222-222222222222",
  "ticketType": "VIP"
}
```

Response

```json
{
  "registrationId": "...",
  "status": "REGISTERED"
}
```

---

# 🛠 Technology Stack

| Layer | Technology |
|--------|------------|
| Backend | Node.js • Express |
| Database | PostgreSQL • Knex.js |
| Cache | Redis |
| Messaging | Kafka • Redis Streams • RabbitMQ |
| AI | OpenAI Function Calling • Tool Registry • Structured Outputs |
| Security | JWT • RBAC |
| Testing | Jest • Supertest • Autocannon |
| Infrastructure | Docker • Docker Compose |

---

#  Python Equivalents

| Node.js Implementation | Python Equivalent |
|-------------------------|-------------------|
| Express | FastAPI / Django REST Framework |
| Knex.js | SQLAlchemy / Django ORM |
| Repository Pattern | Repository Layer |
| Transactional Outbox | Celery + PostgreSQL |
| Kafka Publisher | aiokafka / Celery Workers |
| Tool Registry | Pydantic + OpenAI Tools |

The engineering patterns remain identical regardless of language.

---

# 🚀 Getting Started

## Install

```bash
npm install
```

## Configure

```env
PORT=3000

DATABASE_URL=postgres://localhost/conference

JWT_ACCESS_SECRET=...

JWT_REFRESH_SECRET=...

REDIS_URL=redis://localhost:6379

OPENAI_API_KEY=...
```

## Run

```bash
npm run migrate

npm run dev
```

## Test

```bash
npm test
```

---

# 🎯 Engineering Principles

- Domain-Driven Design
- Clean Architecture
- Event-Driven Systems
- SOLID Principles
- Dependency Injection
- High Cohesion
- Low Coupling
- Immutable Domain Events
- Reliability by Design

---

# 🗺 Roadmap

- ✅ AI Function Calling
- ✅ Tool Registry
- ✅ JWT Authentication
- ✅ Transactional Outbox
- ✅ Redis Integration
- ✅ Performance Benchmarking
- 🚧 Kafka Consumers
- 🚧 Dead Letter Queue
- 🚧 OpenTelemetry
- 🚧 Distributed Tracing
- 🚧 Kubernetes Deployment
- 🚧 Python/FastAPI Reference Implementation

---

# 👨‍💻 Author

## **Rowland Obi**

**Senior Backend Engineer**

Specializing in:

- AI-Enabled Backend Systems
- Distributed Systems
- Domain-Driven Design
- Event-Driven Architecture
- Payment Infrastructure
- PostgreSQL
- Redis
- Kafka

**Primary Stack**

Python • Django • FastAPI • Node.js • PostgreSQL • Redis • Kafka • Docker • Kubernetes

---

# 📄 License

MIT License
