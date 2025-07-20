const { getRedisClient } = require('../config/database');
const logger = require('./logger');

class CacheService {
  constructor() {
    this.redisClient = null;
    this.defaultTTL = 3600; // 1 hour
  }

  async init() {
    try {
      this.redisClient = getRedisClient();
    } catch (error) {
      logger.warn('Cache service initialization failed:', error.message);
    }
  }

  async get(key) {
    if (!this.redisClient) return null;
    
    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    if (!this.redisClient) return false;
    
    try {
      await this.redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.redisClient) return false;
    
    try {
      await this.redisClient.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  async flush() {
    if (!this.redisClient) return false;
    
    try {
      await this.redisClient.flushAll();
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    if (!this.redisClient) return false;
    
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
      return true;
    } catch (error) {
      logger.error('Cache pattern invalidation error:', error);
      return false;
    }
  }

  // Product-specific cache methods
  async cacheProducts(key, products, ttl = 1800) { // 30 minutes
    return this.set(`products:${key}`, products, ttl);
  }

  async getCachedProducts(key) {
    return this.get(`products:${key}`);
  }

  async invalidateProductCache() {
    return this.invalidatePattern('products:*');
  }

  // User-specific cache methods
  async cacheUser(userId, user, ttl = 3600) { // 1 hour
    return this.set(`user:${userId}`, user, ttl);
  }

  async getCachedUser(userId) {
    return this.get(`user:${userId}`);
  }

  async invalidateUserCache(userId) {
    return this.del(`user:${userId}`);
  }

  // Search cache methods
  async cacheSearchResults(query, results, ttl = 900) { // 15 minutes
    return this.set(`search:${query}`, results, ttl);
  }

  async getCachedSearchResults(query) {
    return this.get(`search:${query}`);
  }
}

module.exports = new CacheService();
