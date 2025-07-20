const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, getPagination } = require('../utils/responseHandler');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { mongoIdValidation, paginationValidation } = require('../validators');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

// Multer configuration for avatar upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload an image file'), false);
    }
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 */
router.get('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('favorites', 'title images price')
    .select('-password');

  sendSuccess(res, 'Profile retrieved successfully', user);
}));

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               bio:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'bio', 'phone', 'address', 'preferences'];
  const updates = {};

  // Filter only allowed fields
  Object.keys(req.body).forEach(field => {
    if (allowedFields.includes(field)) {
      updates[field] = req.body[field];
    }
  });

  // Update profile nested object
  if (updates.firstName || updates.lastName || updates.bio) {
    updates.profile = {
      ...req.user.profile,
      ...(updates.firstName && { firstName: updates.firstName }),
      ...(updates.lastName && { lastName: updates.lastName }),
      ...(updates.bio && { bio: updates.bio })
    };
    delete updates.firstName;
    delete updates.lastName;
    delete updates.bio;
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  ).select('-password');

  // Update cache
  await cache.set(`user:${user._id}`, user, 3600);

  logger.info(`Profile updated for user: ${user.email}`);

  sendSuccess(res, 'Profile updated successfully', user);
}));

/**
 * @swagger
 * /api/users/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 */
router.post('/avatar', protect, upload.single('avatar'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Please upload an image file', 400);
  }

  // Process image with Sharp
  const processedImage = await sharp(req.file.buffer)
    .resize(200, 200)
    .jpeg({ quality: 80 })
    .toBuffer();

  // Convert to base64 for storage (in production, use cloud storage)
  const avatarData = `data:image/jpeg;base64,${processedImage.toString('base64')}`;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { 'profile.avatar': avatarData },
    { new: true, runValidators: true }
  ).select('-password');

  // Update cache
  await cache.set(`user:${user._id}`, user, 3600);

  logger.info(`Avatar uploaded for user: ${user.email}`);

  sendSuccess(res, 'Avatar uploaded successfully', {
    avatar: user.profile.avatar
  });
}));

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID (public profile)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/:id', mongoIdValidation, validate, asyncHandler(async (req, res) => {
  // Check cache first
  let user = await cache.get(`user_public:${req.params.id}`);
  
  if (!user) {
    user = await User.findById(req.params.id)
      .select('username profile createdAt rating reviewCount')
      .populate({
        path: 'products',
        select: 'title images price condition createdAt',
        match: { status: 'active' },
        options: { limit: 5, sort: { createdAt: -1 } }
      });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Cache public profile for 30 minutes
    await cache.set(`user_public:${req.params.id}`, user, 1800);
  }

  sendSuccess(res, 'User profile retrieved successfully', user);
}));

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Users]
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
 *       403:
 *         description: Not authorized
 */
router.get('/', protect, authorize('admin'), paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, status } = req.query;

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

  sendSuccess(res, 'Users retrieved successfully', users, 200, pagination);
}));

/**
 * @swagger
 * /api/users/{id}/status:
 *   put:
 *     summary: Update user status (admin only)
 *     tags: [Users]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, suspended, banned]
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       404:
 *         description: User not found
 */
router.put('/:id/status', protect, authorize('admin'), mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['active', 'suspended', 'banned'].includes(status)) {
    return sendError(res, 'Invalid status value', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Clear user cache
  await cache.del(`user:${user._id}`);
  await cache.del(`user_public:${user._id}`);

  logger.info(`User status updated: ${user.email} -> ${status}`);

  sendSuccess(res, 'User status updated successfully', user);
}));

/**
 * @swagger
 * /api/users/{id}/role:
 *   put:
 *     summary: Update user role (admin only)
 *     tags: [Users]
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, moderator, admin]
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       404:
 *         description: User not found
 */
router.put('/:id/role', protect, authorize('admin'), mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!['user', 'moderator', 'admin'].includes(role)) {
    return sendError(res, 'Invalid role value', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Clear user cache
  await cache.del(`user:${user._id}`);
  await cache.del(`user_public:${user._id}`);

  logger.info(`User role updated: ${user.email} -> ${role}`);

  sendSuccess(res, 'User role updated successfully', user);
}));

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 */
router.get('/stats', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        statuses: {
          $push: {
            status: '$_id',
            count: '$count'
          }
        }
      }
    }
  ]);

  const roleStats = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);

  const recentUsers = await User.find()
    .select('username email createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  sendSuccess(res, 'User statistics retrieved successfully', {
    overview: stats[0] || { total: 0, statuses: [] },
    roles: roleStats,
    recent: recentUsers
  });
}));

module.exports = router;
