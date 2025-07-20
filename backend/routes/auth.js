const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerValidation, loginValidation } = require('../validators');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 */
router.post('/register', registerValidation, validate, asyncHandler(async (req, res) => {
  const { username, email, password, firstName, lastName } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    return sendError(res, 'User with this email or username already exists', 400);
  }

  // Hash password
  const salt = await bcryptjs.genSalt(12);
  const hashedPassword = await bcryptjs.hash(password, salt);

  // Create user
  const user = await User.create({
    username,
    email,
    password: hashedPassword,
    firstName,
    lastName,
    profile: {
      firstName,
      lastName
    }
  });

  // Generate token
  const token = generateToken(user._id);

  // Cache user
  await cache.set(`user:${user._id}`, user, 3600);

  // Remove password from response
  user.password = undefined;

  logger.info(`New user registered: ${user.email}`);

  sendSuccess(res, 'Registration successful', {
    token,
    user
  }, 201);
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */
router.post('/login', loginValidation, validate, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return sendError(res, 'Invalid credentials', 401);
  }

  // Check password
  const isPasswordValid = await bcryptjs.compare(password, user.password);

  if (!isPasswordValid) {
    return sendError(res, 'Invalid credentials', 401);
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id);

  // Cache user
  await cache.set(`user:${user._id}`, user, 3600);

  // Remove password from response
  user.password = undefined;

  logger.info(`User logged in: ${user.email}`);

  sendSuccess(res, 'Login successful', {
    token,
    user
  });
}));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Not authorized
 */
router.get('/me', protect, asyncHandler(async (req, res) => {
  sendSuccess(res, 'User profile retrieved', req.user);
}));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', protect, asyncHandler(async (req, res) => {
  // Remove user from cache
  await cache.del(`user:${req.user._id}`);
  
  logger.info(`User logged out: ${req.user.email}`);
  
  sendSuccess(res, 'Logout successful');
}));

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save();

  // Create reset URL
  const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

  logger.info(`Password reset requested for: ${user.email}`);

  // In a real application, you would send an email here
  // For now, we'll just return the reset URL
  sendSuccess(res, 'Password reset email sent', {
    resetUrl // Remove this in production
  });
}));

/**
 * @swagger
 * /api/auth/reset-password/{resetToken}:
 *   put:
 *     summary: Reset password
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: resetToken
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
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.put('/reset-password/:resetToken', asyncHandler(async (req, res) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resetToken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return sendError(res, 'Invalid or expired token', 400);
  }

  // Set new password
  const salt = await bcryptjs.genSalt(12);
  user.password = await bcryptjs.hash(req.body.password, salt);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  // Generate token
  const token = generateToken(user._id);

  logger.info(`Password reset successful for: ${user.email}`);

  sendSuccess(res, 'Password reset successful', { token });
}));

/**
 * @swagger
 * /api/auth/update-password:
 *   put:
 *     summary: Update password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Current password is incorrect
 */
router.put('/update-password', protect, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isPasswordValid = await bcryptjs.compare(currentPassword, user.password);

  if (!isPasswordValid) {
    return sendError(res, 'Current password is incorrect', 400);
  }

  // Hash new password
  const salt = await bcryptjs.genSalt(12);
  user.password = await bcryptjs.hash(newPassword, salt);

  await user.save();

  logger.info(`Password updated for: ${user.email}`);

  sendSuccess(res, 'Password updated successfully');
}));

module.exports = router;
