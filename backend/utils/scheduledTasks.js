const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('./logger');
const cache = require('./cache');

class ScheduledTasks {
  constructor() {
    this.tasks = new Map();
    this.init();
  }

  init() {
    logger.info('Initializing scheduled tasks...');
    
    // Clean up expired sessions daily at 2 AM
    this.scheduleTask('cleanup-sessions', '0 2 * * *', this.cleanupExpiredSessions);
    
    // Clean up old notifications weekly
    this.scheduleTask('cleanup-notifications', '0 3 * * 0', this.cleanupOldNotifications);
    
    // Generate analytics reports daily at 1 AM
    this.scheduleTask('generate-analytics', '0 1 * * *', this.generateDailyAnalytics);
    
    // Clean up old chat messages monthly
    this.scheduleTask('cleanup-chat', '0 4 1 * *', this.cleanupOldMessages);
    
    // Cache warmup every 6 hours
    this.scheduleTask('cache-warmup', '0 */6 * * *', this.warmupCache);
    
    // Database maintenance weekly
    this.scheduleTask('db-maintenance', '0 5 * * 0', this.databaseMaintenance);
    
    logger.info(`Scheduled ${this.tasks.size} tasks`);
  }

  scheduleTask(name, cronExpression, taskFunction) {
    try {
      const task = cron.schedule(cronExpression, async () => {
        logger.info(`Running scheduled task: ${name}`);
        try {
          await taskFunction.call(this);
          logger.info(`Completed scheduled task: ${name}`);
        } catch (error) {
          logger.error(`Error in scheduled task ${name}:`, error);
        }
      }, {
        scheduled: true,
        timezone: 'UTC'
      });
      
      this.tasks.set(name, task);
      logger.info(`Scheduled task: ${name} (${cronExpression})`);
    } catch (error) {
      logger.error(`Failed to schedule task ${name}:`, error);
    }
  }

  async cleanupExpiredSessions() {
    try {
      // Clean up any session-related data if using sessions
      // This is a placeholder - implement based on your session storage
      logger.info('Session cleanup completed');
    } catch (error) {
      logger.error('Session cleanup failed:', error);
    }
  }

  async cleanupOldNotifications() {
    try {
      const Notification = mongoose.model('Notification');
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await Notification.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        read: true
      });
      
      logger.info(`Cleaned up ${result.deletedCount} old notifications`);
    } catch (error) {
      logger.error('Notification cleanup failed:', error);
    }
  }

  async generateDailyAnalytics() {
    try {
      // Generate and cache daily analytics
      const Product = mongoose.model('Product');
      const User = mongoose.model('User');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const analytics = {
        date: today,
        totalProducts: await Product.countDocuments(),
        totalUsers: await User.countDocuments(),
        newProductsToday: await Product.countDocuments({
          createdAt: { $gte: today }
        }),
        newUsersToday: await User.countDocuments({
          createdAt: { $gte: today }
        })
      };
      
      // Cache the analytics
      await cache.set(`analytics:daily:${today.toISOString().split('T')[0]}`, analytics, 24 * 60 * 60);
      
      logger.info('Daily analytics generated and cached');
    } catch (error) {
      logger.error('Daily analytics generation failed:', error);
    }
  }

  async cleanupOldMessages() {
    try {
      const Message = mongoose.model('Message');
      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
      
      const result = await Message.deleteMany({
        createdAt: { $lt: sixMonthsAgo },
        deletedAt: { $exists: true }
      });
      
      logger.info(`Cleaned up ${result.deletedCount} old deleted messages`);
    } catch (error) {
      logger.error('Message cleanup failed:', error);
    }
  }

  async warmupCache() {
    try {
      // Warm up frequently accessed data
      const Category = mongoose.model('Category');
      const Product = mongoose.model('Product');
      
      // Cache categories
      const categories = await Category.find({ active: true }).lean();
      await cache.set('categories:active', categories, 60 * 60); // 1 hour
      
      // Cache popular products
      const popularProducts = await Product.find({ status: 'approved' })
        .sort({ views: -1, rating: -1 })
        .limit(20)
        .lean();
      await cache.set('products:popular', popularProducts, 30 * 60); // 30 minutes
      
      logger.info('Cache warmup completed');
    } catch (error) {
      logger.error('Cache warmup failed:', error);
    }
  }

  async databaseMaintenance() {
    try {
      // Rebuild indexes for better performance
      const collections = ['users', 'products', 'notifications', 'messages', 'conversations'];
      
      for (const collectionName of collections) {
        try {
          const collection = mongoose.connection.collection(collectionName);
          await collection.reIndex();
          logger.info(`Reindexed collection: ${collectionName}`);
        } catch (error) {
          logger.warn(`Failed to reindex ${collectionName}:`, error.message);
        }
      }
      
      // Clean up any orphaned data
      await this.cleanupOrphanedData();
      
      logger.info('Database maintenance completed');
    } catch (error) {
      logger.error('Database maintenance failed:', error);
    }
  }

  async cleanupOrphanedData() {
    try {
      const Product = mongoose.model('Product');
      const Comment = mongoose.model('Comment');
      const Notification = mongoose.model('Notification');
      
      // Remove comments for non-existent products
      const productIds = await Product.distinct('_id');
      const orphanedComments = await Comment.deleteMany({
        product: { $nin: productIds }
      });
      
      // Remove notifications for non-existent users
      const User = mongoose.model('User');
      const userIds = await User.distinct('_id');
      const orphanedNotifications = await Notification.deleteMany({
        user: { $nin: userIds }
      });
      
      logger.info(`Cleaned up ${orphanedComments.deletedCount} orphaned comments and ${orphanedNotifications.deletedCount} orphaned notifications`);
    } catch (error) {
      logger.error('Orphaned data cleanup failed:', error);
    }
  }

  // Manual task execution (for admin interface)
  async runTask(taskName) {
    const task = this.tasks.get(taskName);
    if (!task) {
      throw new Error(`Task not found: ${taskName}`);
    }
    
    logger.info(`Manually running task: ${taskName}`);
    await task.task();
  }

  // Get task status
  getTaskStatus() {
    const status = {};
    this.tasks.forEach((task, name) => {
      status[name] = {
        running: task.running,
        lastRun: task.lastDate,
        nextRun: task.nextDate
      };
    });
    return status;
  }

  // Stop all tasks
  stopAllTasks() {
    this.tasks.forEach((task, name) => {
      task.stop();
      logger.info(`Stopped task: ${name}`);
    });
  }

  // Start all tasks
  startAllTasks() {
    this.tasks.forEach((task, name) => {
      task.start();
      logger.info(`Started task: ${name}`);
    });
  }
}

module.exports = new ScheduledTasks();
