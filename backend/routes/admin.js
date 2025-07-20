const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Comment = require('../models/Comment');
const Category = require('../models/Category');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, getPagination } = require('../utils/responseHandler');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { mongoIdValidation, paginationValidation } = require('../validators');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

// All admin routes require admin role
router.use(protect);
router.use(authorize('admin'));

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard overview
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get current date for comparisons
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get overview statistics
  const [
    totalUsers,
    newUsers,
    totalProducts,
    newProducts,
    activeProducts,
    soldProducts,
    totalComments,
    pendingComments,
    totalCategories
  ] = await Promise.all([
    User.countDocuments({ status: { $ne: 'deleted' } }),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'deleted' } }),
    Product.countDocuments({ status: { $ne: 'deleted' } }),
    Product.countDocuments({ createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'deleted' } }),
    Product.countDocuments({ status: 'active' }),
    Product.countDocuments({ status: 'sold' }),
    Comment.countDocuments({ status: { $ne: 'deleted' } }),
    Comment.countDocuments({ status: 'pending' }),
    Category.countDocuments({ status: 'active' })
  ]);

  // Get recent activity
  const recentUsers = await User.find({ status: { $ne: 'deleted' } })
    .select('username email createdAt status role')
    .sort({ createdAt: -1 })
    .limit(5);

  const recentProducts = await Product.find({ status: { $ne: 'deleted' } })
    .populate('seller', 'username')
    .populate('category', 'name')
    .select('title price status createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  const pendingModerationComments = await Comment.find({ status: 'pending' })
    .populate('user', 'username')
    .populate('product', 'title')
    .select('content rating createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  // Get user growth trend (last 30 days)
  const userGrowthTrend = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        status: { $ne: 'deleted' }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  const dashboardData = {
    overview: {
      users: { total: totalUsers, new: newUsers },
      products: { total: totalProducts, new: newProducts, active: activeProducts, sold: soldProducts },
      comments: { total: totalComments, pending: pendingComments },
      categories: { total: totalCategories }
    },
    recentActivity: {
      users: recentUsers,
      products: recentProducts,
      pendingComments: pendingModerationComments
    },
    trends: {
      userGrowth: userGrowthTrend
    }
  };

  sendSuccess(res, 'Dashboard data retrieved successfully', dashboardData);
}));

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get users for admin management
 *     tags: [Admin]
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
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/users', paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role, status } = req.query;

  // Build query
  const query = {};
  
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { 'profile.firstName': { $regex: search, $options: 'i' } },
      { 'profile.lastName': { $regex: search, $options: 'i' } }
    ];
  }

  if (role && role !== 'all') {
    query.role = role;
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(query)
  ]);

  const pagination = getPagination(page, limit, total);

  sendSuccess(res, 'Users retrieved successfully', { users, pagination });
}));

/**
 * @swagger
 * /api/admin/users/{id}/actions:
 *   put:
 *     summary: Perform admin actions on user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [activate, suspend, ban, promote, demote]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Action performed successfully
 *       404:
 *         description: User not found
 */
router.put('/users/:id/actions', mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  
  const validActions = ['activate', 'suspend', 'ban', 'promote', 'demote'];
  if (!validActions.includes(action)) {
    return sendError(res, 'Invalid action', 400);
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Perform action
  switch (action) {
    case 'activate':
      user.status = 'active';
      break;
    case 'suspend':
      user.status = 'suspended';
      break;
    case 'ban':
      user.status = 'banned';
      break;
    case 'promote':
      user.role = user.role === 'user' ? 'moderator' : 'admin';
      break;
    case 'demote':
      user.role = user.role === 'admin' ? 'moderator' : 'user';
      break;
  }

  await user.save();

  // Create notification for user (except for promotions/demotions)
  if (['suspend', 'ban', 'activate'].includes(action)) {
    await Notification.create({
      recipient: user._id,
      type: 'system',
      title: `Account ${action}d`,
      message: reason || `Your account has been ${action}d by an administrator.`,
      data: {
        action,
        reason,
        adminId: req.user._id
      }
    });
  }

  // Clear user cache
  await cache.del(`user:${user._id}`);

  logger.info(`Admin action performed: ${action} on user ${user._id} by ${req.user._id}. Reason: ${reason}`);

  sendSuccess(res, `User ${action}d successfully`, user);
}));

/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     summary: Get products for admin management
 *     tags: [Admin]
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
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get('/products', paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;

  // Build query
  const query = {};
  
  if (status && status !== 'all') {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('seller', 'username email')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  const pagination = getPagination(page, limit, total);

  sendSuccess(res, 'Products retrieved successfully', { products, pagination });
}));

/**
 * @swagger
 * /api/admin/products/{id}/moderate:
 *   put:
 *     summary: Moderate a product
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject, delete]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product moderated successfully
 *       404:
 *         description: Product not found
 */
router.put('/products/:id/moderate', mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  
  const validActions = ['approve', 'reject', 'delete'];
  if (!validActions.includes(action)) {
    return sendError(res, 'Invalid action', 400);
  }

  const product = await Product.findById(req.params.id).populate('seller', 'username email');
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Perform action
  switch (action) {
    case 'approve':
      product.status = 'active';
      break;
    case 'reject':
      product.status = 'inactive';
      break;
    case 'delete':
      product.status = 'deleted';
      break;
  }

  await product.save();

  // Create notification for product owner
  await Notification.create({
    recipient: product.seller._id,
    type: 'system',
    title: `Product ${action}d`,
    message: `Your product "${product.title}" has been ${action}d. ${reason ? `Reason: ${reason}` : ''}`,
    data: {
      productId: product._id,
      action,
      reason,
      adminId: req.user._id
    }
  });

  // Clear product cache
  await cache.del(`product:${product._id}`);

  logger.info(`Product moderated: ${action} on product ${product._id} by ${req.user._id}. Reason: ${reason}`);

  sendSuccess(res, `Product ${action}d successfully`, product);
}));

/**
 * @swagger
 * /api/admin/comments:
 *   get:
 *     summary: Get comments for moderation
 *     tags: [Admin]
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
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 */
router.get('/comments', paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = 'pending' } = req.query;

  // Build query
  const query = {};
  if (status && status !== 'all') {
    query.status = status;
  }

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [comments, total] = await Promise.all([
    Comment.find(query)
      .populate('user', 'username email')
      .populate('product', 'title')
      .populate('moderatedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Comment.countDocuments(query)
  ]);

  const pagination = getPagination(page, limit, total);

  sendSuccess(res, 'Comments retrieved successfully', { comments, pagination });
}));

/**
 * @swagger
 * /api/admin/system/cache/clear:
 *   post:
 *     summary: Clear system cache
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/system/cache/clear', asyncHandler(async (req, res) => {
  try {
    // Clear all cache keys (this is Redis-specific)
    await cache.flushAll();
    
    logger.info(`System cache cleared by admin ${req.user._id}`);
    
    sendSuccess(res, 'Cache cleared successfully');
  } catch (error) {
    logger.error('Error clearing cache:', error);
    sendError(res, 'Failed to clear cache', 500);
  }
}));

/**
 * @swagger
 * /api/admin/system/stats:
 *   get:
 *     summary: Get system statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics retrieved successfully
 */
router.get('/system/stats', asyncHandler(async (req, res) => {
  const stats = {
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform
    },
    database: {
      collections: {
        users: await User.countDocuments(),
        products: await Product.countDocuments(),
        comments: await Comment.countDocuments(),
        categories: await Category.countDocuments()
      }
    },
    cache: {
      // This would be Redis-specific stats
      status: 'connected',
      keys: 0 // Placeholder
    }
  };

  sendSuccess(res, 'System statistics retrieved successfully', stats);
}));

/**
 * @swagger
 * /api/admin/broadcast:
 *   post:
 *     summary: Send system-wide notification
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               targetRole:
 *                 type: string
 *                 enum: [all, user, moderator, admin]
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *     responses:
 *       200:
 *         description: Broadcast notification sent successfully
 */
router.post('/broadcast', asyncHandler(async (req, res) => {
  const { title, message, targetRole = 'all', priority = 'normal' } = req.body;

  // Get target users based on role
  const query = { status: 'active' };
  if (targetRole !== 'all') {
    query.role = targetRole;
  }

  const targetUsers = await User.find(query).select('_id');

  // Create notifications for all target users
  const notifications = targetUsers.map(user => ({
    recipient: user._id,
    sender: req.user._id,
    type: 'system',
    title,
    message,
    priority
  }));

  await Notification.insertMany(notifications);

  // Emit socket event for real-time delivery
  const io = req.app.get('io');
  targetUsers.forEach(user => {
    io.to(`user_${user._id}`).emit('systemNotification', {
      title,
      message,
      priority
    });
  });

  logger.info(`Broadcast notification sent to ${targetUsers.length} users by admin ${req.user._id}`);

  sendSuccess(res, 'Broadcast notification sent successfully', {
    sentTo: targetUsers.length,
    targetRole,
    priority
  });
}));

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: Get reported content
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reported content retrieved successfully
 */
router.get('/reports', asyncHandler(async (req, res) => {
  // This would typically come from a reports collection
  // For now, return mock data structure
  const reports = {
    products: await Product.find({ 'flags.isReported': true })
      .populate('seller', 'username')
      .select('title flags createdAt'),
    comments: await Comment.find({ status: 'reported' })
      .populate('user', 'username')
      .populate('product', 'title')
      .select('content flags createdAt'),
    users: await User.find({ 'flags.isReported': true })
      .select('username email flags createdAt')
  };

  sendSuccess(res, 'Reported content retrieved successfully', reports);
}));

module.exports = router;
