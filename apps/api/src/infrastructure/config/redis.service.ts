import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  async onModuleInit() {
    try {
      await this.connect();
    } catch (error) {
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) {
        this.logger.warn(
          '⚠️ Redis not available in development — API will run without Redis. ' +
            'Rate limiting and refresh tokens will use safe defaults.',
        );
        // Create a no-op client so that method calls don't crash with
        // "Cannot read properties of undefined". Each public method
        // checks `this.client` and returns a safe default when falsy.
        this.client = null as unknown as Redis;
      } else {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      // Detectamos si estamos en producción (Upstash) o local (Docker)
      const isUpstash = process.env.REDIS_URL?.includes('upstash.io');
      const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

      const redisConfig: any = {
        maxRetriesPerRequest: 5,
        retryStrategy: (times: number) => Math.min(times * 500, 5000),
        connectTimeout: 10000,
        enableReadyCheck: true,
      };

      // 🛡️ CONFIGURACIÓN DINÁMICA
      if (isUpstash) {
        // Si es Upstash, necesitamos seguridad y credenciales
        this.logger.log('🌐 Configurando conexión para Redis Cloud (Upstash)');
        redisConfig.password = process.env.REDIS_PASSWORD;
        redisConfig.username = 'default';
        redisConfig.tls = { rejectUnauthorized: false };
      } else {
        // Si es Docker/Local, vamos por vía directa sin TLS
        this.logger.log('🐳 Configurando conexión para Redis Local (Docker)');
        // En Docker local, usualmente no hay password ni TLS
      }

      // Inicializamos el cliente
      this.client = new Redis(redisUrl, redisConfig);

      // Manejo de eventos
      this.client.on('connecting', () => {
        this.logger.log(`🔄 Intentando conectar a Redis en: ${redisUrl}`);
      });

      this.client.on('connect', () => {
        this.logger.log('✅ Conectado a Redis con éxito');
      });

      this.client.on('error', (err) => {
        this.logger.error(`❌ Error de Redis: ${err.message}`);
      });

      await this.client.ping();
      this.logger.log('🚀 Redis listo para operar');
    } catch (error) {
      this.logger.error('💥 Error crítico de Redis', error);
      throw error;
    }
  }

  private async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('🔒 Redis connection closed gracefully');
      } catch (error) {
        this.logger.error('🚧 Error closing Redis connection', error);
      }
    }
  }

  /** Guard: returns true when the client is available */
  public isConnected(): boolean {
    if (!this.client) {
      this.logger.warn('⚠️ Redis not available — call skipped');
      return false;
    }
    return true;
  }

  async set(
    key: string,
    value: string | object,
    ttlSeconds?: number,
  ): Promise<void> {
    if (!this.isConnected()) return;
    try {
      const stringValue =
        typeof value === 'object' ? JSON.stringify(value) : value;
      if (ttlSeconds) {
        await this.client!.setex(key, ttlSeconds, stringValue);
      } else {
        await this.client!.set(key, stringValue);
      }
    } catch (error) {
      this.logger.error(`⚠️ Error setting key ${key} in Redis`, error.stack);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected()) return null;
    try {
      return await this.client!.get(key);
    } catch (error) {
      this.logger.error(`⚠️ Error getting key ${key} from Redis`, error.stack);
      throw error;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) return null;
    try {
      const value = await this.client!.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(
        `⚠️ Error getting JSON key ${key} from Redis`,
        error.stack,
      );
      throw error;
    }
  }

  async delete(key: string): Promise<number> {
    if (!this.isConnected()) return 0;
    try {
      return await this.client!.del(key);
    } catch (error) {
      this.logger.error(`⚠️ Error deleting key ${key} from Redis`, error.stack);
      throw error;
    }
  }

  /**
   * Atomically increment a counter key. On the first increment (count === 1),
   * apply `ttlSeconds` so the counter auto-expires. Mirrors the `set` API
   * shape so callers can opt-in to TTL behavior identically.
   *
   * Returns the new count value.
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.isConnected()) return 0;
    try {
      const count = await this.client!.incr(key);
      if (ttlSeconds && count === 1) {
        await this.client!.expire(key, ttlSeconds);
      }
      return count;
    } catch (error) {
      this.logger.error(
        `⚠️ Error incrementing key ${key} in Redis`,
        error.stack,
      );
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected()) return [];
    try {
      return await this.client!.keys(pattern);
    } catch (error) {
      this.logger.error(
        `⚠️ Error getting keys with pattern ${pattern}`,
        error.stack,
      );
      throw error;
    }
  }

  async flushAll(): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client!.flushall();
    } catch (error) {
      this.logger.error('Error flushing Redis', error.stack);
      throw error;
    }
  }
}
