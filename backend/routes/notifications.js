const express = require('express');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, getPagination } = require('../utils/responseHandler');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { mongoIdValidation, paginationValidation } = require('../validators');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [message, favorite, comment, offer, system, product_sold]
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get('/', protect, paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, unread } = req.query;

  // Build query
  const query = { recipient: req.user._id };
  
  if (type) {
    query.type = type;
  }
  
  if (unread === 'true') {
    query.isRead = false;
  }

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate('sender', 'username profile.firstName profile.lastName profile.avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: req.user._id, isRead: false })
  ]);

  const pagination = getPagination(page, limit, total);

  sendSuccess(res, 'Notifications retrieved successfully', {
    notifications,
    unreadCount,
    pagination
  });
}));

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notifications count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 */
router.get('/unread-count', protect, asyncHandler(async (req, res) => {
  // Check cache first
  let unreadCount = await cache.get(`unread_notifications:${req.user._id}`);
  
  if (unreadCount === null) {
    unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });
    
    // Cache for 1 minute
    await cache.set(`unread_notifications:${req.user._id}`, unreadCount, 60);
  }

  sendSuccess(res, 'Unread count retrieved successfully', { unreadCount });
}));

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.put('/:id/read', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  ).populate('sender', 'username profile.firstName profile.lastName profile.avatar');

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
  }

  // Clear cache
  await cache.del(`unread_notifications:${req.user._id}`);

  // Emit socket event for real-time updates
  const io = req.app.get('io');
  io.to(`user_${req.user._id}`).emit('notificationRead', {
    notificationId: req.params.id
  });

  sendSuccess(res, 'Notification marked as read', notification);
}));

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.put('/mark-all-read', protect, asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  // Clear cache
  await cache.del(`unread_notifications:${req.user._id}`);

  // Emit socket event for real-time updates
  const io = req.app.get('io');
  io.to(`user_${req.user._id}`).emit('allNotificationsRead');

  logger.info(`${result.modifiedCount} notifications marked as read for user ${req.user._id}`);

  sendSuccess(res, 'All notifications marked as read', {
    markedCount: result.modifiedCount
  });
}));

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       404:
 *         description: Notification not found
 */
router.delete('/:id', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id
  });

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
  }

  // Clear cache
  await cache.del(`unread_notifications:${req.user._id}`);

  logger.info(`Notification ${req.params.id} deleted by user ${req.user._id}`);

  sendSuccess(res, 'Notification deleted successfully');
}));

/**
 * @swagger
 * /api/notifications/clear:
 *   delete:
 *     summary: Clear all notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: readOnly
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Notifications cleared successfully
 */
router.delete('/clear', protect, asyncHandler(async (req, res) => {
  const { readOnly } = req.query;

  // Build query
  const query = { recipient: req.user._id };
  
  if (readOnly === 'true') {
    query.isRead = true;
  }

  const result = await Notification.deleteMany(query);

  // Clear cache
  await cache.del(`unread_notifications:${req.user._id}`);

  logger.info(`${result.deletedCount} notifications cleared for user ${req.user._id}`);

  sendSuccess(res, 'Notifications cleared successfully', {
    deletedCount: result.deletedCount
  });
}));

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 */
router.get('/settings', protect, asyncHandler(async (req, res) => {
  // Get user's notification preferences
  const User = require('../models/User');
  const user = await User.findById(req.user._id).select('preferences.notifications');

  const defaultSettings = {
    email: {
      newMessage: true,
      productFavorited: true,
      productCommented: true,
      offerReceived: true,
      systemUpdates: true
    },
    push: {
      newMessage: true,
      productFavorited: false,
      productCommented: true,
      offerReceived: true,
      systemUpdates: false
    }
  };

  const settings = user.preferences?.notifications || defaultSettings;

  sendSuccess(res, 'Notification settings retrieved successfully', settings);
}));

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: Update notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: object
 *               push:
 *                 type: object
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 */
router.put('/settings', protect, asyncHandler(async (req, res) => {
  const { email, push } = req.body;

  const User = require('../models/User');
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      'preferences.notifications': {
        email: email || {},
        push: push || {}
      }
    },
    { new: true, runValidators: true }
  ).select('preferences.notifications');

  logger.info(`Notification settings updated for user ${req.user._id}`);

  sendSuccess(res, 'Notification settings updated successfully', user.preferences.notifications);
}));

// Helper function to create a notification (used by other routes)
const createNotification = async (notificationData) => {
  try {
    const notification = await Notification.create(notificationData);
    
    // Populate sender info
    await notification.populate('sender', 'username profile.firstName profile.lastName profile.avatar');
    
    // Clear recipient's unread count cache
    await cache.del(`unread_notifications:${notification.recipient}`);
    
    // Emit socket event for real-time notifications
    const io = global.io; // Assuming io is available globally
    if (io) {
      io.to(`user_${notification.recipient}`).emit('newNotification', notification);
    }
    
    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

// Export the helper function for use in other modules
router.createNotification = createNotification;

module.exports = router;
