const mongoose = require('mongoose');
const redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis Connected');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis Reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    await redisClient.connect();
  } catch (error) {
    logger.warn('Redis connection failed:', error.message);
    logger.warn('Continuing without Redis cache...');
  }
};

const getRedisClient = () => redisClient;

module.exports = {
  connectDB,
  connectRedis,
  getRedisClient
};
