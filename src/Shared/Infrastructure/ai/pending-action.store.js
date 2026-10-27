/** Single-use, short-lived proposals awaiting user confirmation. take() must be atomic. */
export class RedisPendingActionStore {
  constructor({ redis, prefix = 'llm:pending:' }) { this.redis = redis; this.prefix = prefix; }
  async save(pending, ttlSec) {
    await this.redis.set(this.prefix + pending.id, JSON.stringify(pending), 'EX', ttlSec);
  }
  async take(id) {
    const raw = await this.redis.getdel(this.prefix + id); // Redis >= 6.2
    return raw ? JSON.parse(raw) : null;
  }
}

export class InMemoryPendingActionStore {   // for tests
  #m = new Map();
  async save(p) { this.#m.set(p.id, p); }
  async take(id) { const p = this.#m.get(id) ?? null; this.#m.delete(id); return p; }
}