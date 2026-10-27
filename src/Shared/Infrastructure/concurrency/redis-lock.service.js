/**
 * @file src/Shared/infrastructure/services/redis-lock.service.js
 * @description Distributed locking mechanism using Redis atomic primitives and Lua scripts.
 */

const { randomUUID } = require('crypto');

class RedisLockService {
  /**
   * @param {Object} params
   * @param {import('ioredis').Redis} params.redisClient - Configured ioredis client instance
   * @param {Object} [params.logger] - Application logger instance
   */
  constructor({ redisClient, logger = null }) {
    if (!redisClient) {
      throw new Error('[RedisLockService] redisClient is required.');
    }
    this.redis = redisClient;
    this.logger = logger;

    this._registerLuaCommands();
  }

  /**
   * Safely registers Lua commands on ioredis without prototype pollution errors.
   * @private
   */
  _registerLuaCommands() {
    if (typeof this.redis.releaseLock !== 'function') {
      this.redis.defineCommand('releaseLock', {
        numberOfKeys: 1,
        lua: `
          if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
          else
              return 0
          end
        `,
      });
    }

    if (typeof this.redis.extendLock !== 'function') {
      this.redis.defineCommand('extendLock', {
        numberOfKeys: 1,
        lua: `
          if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("pexpire", KEYS[1], ARGV[2])
          else
              return 0
          end
        `,
      });
    }
  }

  /**
   * Tries to acquire a lock for a given resource.
   *
   * @param {string} resourceKey - Unique identifier for the lock target (e.g. `lock:account:123`)
   * @param {number} [ttlMs=10000] - Lock expiration time in milliseconds
   * @returns {Promise<string|null>} Lock token string if acquired, null if already locked
   */
  async acquire(resourceKey, ttlMs = 10000) {
    const lockToken = randomUUID();

    // SET resourceKey lockToken NX PX ttlMs
    const acquired = await this.redis.set(
      resourceKey,
      lockToken,
      'PX',
      ttlMs,
      'NX'
    );

    if (acquired === 'OK') {
      if (this.logger) {
        this.logger.debug(`[RedisLockService] Acquired lock for '${resourceKey}'`);
      }
      return lockToken;
    }

    return null;
  }

  /**
   * Releases a lock safely using Lua to ensure ownership matches the token.
   *
   * @param {string} resourceKey - Resource lock identifier
   * @param {string} lockToken - Token returned during acquisition
   * @returns {Promise<boolean>} True if successfully unlocked, false otherwise
   */
  async release(resourceKey, lockToken) {
    if (!lockToken) return false;

    try {
      const result = await this.redis.releaseLock(resourceKey, lockToken);
      const released = result === 1;

      if (this.logger) {
        if (released) {
          this.logger.debug(`[RedisLockService] Released lock for '${resourceKey}'`);
        } else {
          this.logger.warn(`[RedisLockService] Failed to release lock '${resourceKey}'. Token mismatched or lock expired.`);
        }
      }

      return released;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`[RedisLockService] Error releasing lock for '${resourceKey}': ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Extends the TTL of an active lock if the token matches.
   *
   * @param {string} resourceKey - Resource lock identifier
   * @param {string} lockToken - Token returned during acquisition
   * @param {number} ttlMs - Extra TTL in milliseconds
   * @returns {Promise<boolean>}
   */
  async extend(resourceKey, lockToken, ttlMs) {
    if (!lockToken) return false;
    try {
      const result = await this.redis.extendLock(resourceKey, lockToken, ttlMs);
      return result === 1;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`[RedisLockService] Error extending lock for '${resourceKey}': ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Higher-Order Helper: Executes an async function wrapped inside an auto-renewing distributed lock.
   *
   * @param {string} resourceKey - Resource lock target key
   * @param {number} ttlMs - Base lock timeout
   * @param {Function} asyncFn - Callback async function `async (lockSignal) => { ... }`
   * @param {Object} [options]
   * @param {number} [options.retryCount=0] - Number of times to retry acquiring lock
   * @param {number} [options.retryDelayMs=200] - Backoff delay between retries
   * @returns {Promise<any>} Result of asyncFn
   */
  async runWithLock(resourceKey, ttlMs, asyncFn, options = {}) {
    const { retryCount = 0, retryDelayMs = 200 } = options;
    let lockToken = null;

    // Acquire lock with optional retries
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      lockToken = await this.acquire(resourceKey, ttlMs);
      if (lockToken) break;

      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    if (!lockToken) {
      throw new Error(`[RedisLockService] Could not acquire lock for '${resourceKey}' after ${retryCount + 1} attempt(s).`);
    }

    let heartbeatTimer = null;
    let isHeartbeatActive = true;

    // Robust, non-overlapping heartbeat renewal loop
    const scheduleHeartbeat = () => {
      const renewalIntervalMs = Math.max(Math.floor(ttlMs / 2), 100);

      heartbeatTimer = setTimeout(async () => {
        if (!isHeartbeatActive) return;

        const extended = await this.extend(resourceKey, lockToken, ttlMs);
        if (!extended) {
          if (this.logger) {
            this.logger.warn(`[RedisLockService] Heartbeat lock extension failed for '${resourceKey}'. Lock may have been lost.`);
          }
        }

        // Schedule next check only if execution is still active
        if (isHeartbeatActive) {
          scheduleHeartbeat();
        }
      }, renewalIntervalMs);
    };

    scheduleHeartbeat();

    try {
      return await asyncFn();
    } finally {
      isHeartbeatActive = false;
      if (heartbeatTimer) {
        clearTimeout(heartbeatTimer);
      }
      await this.release(resourceKey, lockToken);
    }
  }
}

module.exports = RedisLockService;