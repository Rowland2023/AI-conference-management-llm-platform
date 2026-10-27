# AI-Powered Conference Management Platform

Production-ready conference management backend with Node.js 22, Express, PostgreSQL, Redis, Kafka, LLM tool-calling.

Core principle: LLM proposes -> Backend validates, authorizes, confirms -> Use-case executes.

## Tech Stack
Node 22, Express, PostgreSQL + Knex, Redis, Kafka, Pino, OpenAI, Zod, Jest 113 tests, ESLint flat config, Docker Compose, Autocannon 3561 rps

## Quick Start
npm ci, docker compose up -d, cp .env.example .env, npm run migrate, npm start

## Performance
Autocannon GET /health 30s: 25c 3561 rps 6.52ms avg

## License MIT
Author: Rowland Obi
