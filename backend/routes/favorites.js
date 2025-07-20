const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
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
 * /api/favorites:
 *   get:
 *     summary: Get user's favorite products
 *     tags: [Favorites]
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
 *     responses:
 *       200:
 *         description: Favorites retrieved successfully
 */
router.get('/', protect, paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 12 } = req.query;

  // Get user with populated favorites
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const user = await User.findById(req.user._id)
    .populate({
      path: 'favorites',
      match: { status: 'active' },
      populate: [
        { 
          path: 'seller', 
          select: 'username profile.firstName profile.lastName profile.avatar rating' 
        },
        { 
          path: 'category', 
          select: 'name slug' 
        }
      ],
      options: {
        skip: skip,
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      }
    });

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Get total count of favorites for pagination
  const totalFavorites = await User.aggregate([
    { $match: { _id: user._id } },
    { $unwind: '$favorites' },
    {
      $lookup: {
        from: 'products',
        localField: 'favorites',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    { $match: { 'product.status': 'active' } },
    { $count: 'total' }
  ]);

  const total = totalFavorites[0]?.total || 0;
  const pagination = getPagination(page, limit, total);

  // Add isFavorite field (always true for favorites list)
  const favoritesWithFlag = user.favorites.map(product => ({
    ...product._doc,
    isFavorite: true
  }));

  sendSuccess(res, 'Favorites retrieved successfully', favoritesWithFlag, 200, pagination);
}));

/**
 * @swagger
 * /api/favorites/{productId}:
 *   post:
 *     summary: Add product to favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product added to favorites
 *       400:
 *         description: Product already in favorites
 *       404:
 *         description: Product not found
 */
router.post('/:productId', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { productId } = req.params;

  // Check if product exists and is active
  const product = await Product.findOne({ 
    _id: productId, 
    status: 'active' 
  }).select('title images price seller');

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if user can favorite their own product
  if (product.seller.toString() === req.user._id.toString()) {
    return sendError(res, 'You cannot favorite your own product', 400);
  }

  // Check if already in favorites
  const user = await User.findById(req.user._id);
  
  if (user.favorites.includes(productId)) {
    return sendError(res, 'Product already in favorites', 400);
  }

  // Add to favorites
  await User.findByIdAndUpdate(req.user._id, {
    $push: { favorites: productId }
  });

  // Update product favorites count
  await Product.findByIdAndUpdate(productId, {
    $inc: { favoritesCount: 1 }
  });

  // Clear user cache
  await cache.del(`user:${req.user._id}`);

  // Emit socket event for real-time updates
  const io = req.app.get('io');
  io.to(`user_${product.seller}`).emit('productFavorited', {
    productId,
    productTitle: product.title,
    userId: req.user._id,
    username: req.user.username
  });

  logger.info(`Product ${productId} added to favorites by user ${req.user._id}`);

  sendSuccess(res, 'Product added to favorites', {
    productId,
    title: product.title,
    isFavorite: true
  });
}));

/**
 * @swagger
 * /api/favorites/{productId}:
 *   delete:
 *     summary: Remove product from favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product removed from favorites
 *       400:
 *         description: Product not in favorites
 *       404:
 *         description: Product not found
 */
router.delete('/:productId', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { productId } = req.params;

  // Check if product exists
  const product = await Product.findById(productId).select('title seller');

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if in favorites
  const user = await User.findById(req.user._id);
  
  if (!user.favorites.includes(productId)) {
    return sendError(res, 'Product not in favorites', 400);
  }

  // Remove from favorites
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { favorites: productId }
  });

  // Update product favorites count
  await Product.findByIdAndUpdate(productId, {
    $inc: { favoritesCount: -1 }
  });

  // Clear user cache
  await cache.del(`user:${req.user._id}`);

  logger.info(`Product ${productId} removed from favorites by user ${req.user._id}`);

  sendSuccess(res, 'Product removed from favorites', {
    productId,
    title: product.title,
    isFavorite: false
  });
}));

/**
 * @swagger
 * /api/favorites/{productId}/check:
 *   get:
 *     summary: Check if product is in user's favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Favorite status retrieved
 *       404:
 *         description: Product not found
 */
router.get('/:productId/check', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { productId } = req.params;

  // Check if product exists
  const product = await Product.findById(productId).select('title');

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if in user's favorites
  const user = await User.findById(req.user._id).select('favorites');
  const isFavorite = user.favorites.includes(productId);

  sendSuccess(res, 'Favorite status retrieved', {
    productId,
    title: product.title,
    isFavorite
  });
}));

/**
 * @swagger
 * /api/favorites/bulk:
 *   post:
 *     summary: Add multiple products to favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productIds
 *             properties:
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Products added to favorites
 *       400:
 *         description: Invalid product IDs or some products already in favorites
 */
router.post('/bulk', protect, asyncHandler(async (req, res) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return sendError(res, 'Please provide an array of product IDs', 400);
  }

  // Validate all product IDs and check if they exist and are active
  const products = await Product.find({
    _id: { $in: productIds },
    status: 'active',
    seller: { $ne: req.user._id } // Exclude user's own products
  }).select('_id title seller');

  if (products.length === 0) {
    return sendError(res, 'No valid products found', 400);
  }

  const validProductIds = products.map(p => p._id.toString());

  // Get current user favorites
  const user = await User.findById(req.user._id).select('favorites');
  const currentFavorites = user.favorites.map(id => id.toString());

  // Filter out products already in favorites
  const newFavorites = validProductIds.filter(id => !currentFavorites.includes(id));

  if (newFavorites.length === 0) {
    return sendError(res, 'All products are already in favorites', 400);
  }

  // Add new favorites
  await User.findByIdAndUpdate(req.user._id, {
    $push: { favorites: { $each: newFavorites } }
  });

  // Update favorites count for each product
  await Product.updateMany(
    { _id: { $in: newFavorites } },
    { $inc: { favoritesCount: 1 } }
  );

  // Clear user cache
  await cache.del(`user:${req.user._id}`);

  logger.info(`${newFavorites.length} products added to favorites by user ${req.user._id}`);

  sendSuccess(res, 'Products added to favorites', {
    added: newFavorites.length,
    total: currentFavorites.length + newFavorites.length
  });
}));

/**
 * @swagger
 * /api/favorites/clear:
 *   delete:
 *     summary: Clear all favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All favorites cleared
 */
router.delete('/clear', protect, asyncHandler(async (req, res) => {
  // Get current favorites
  const user = await User.findById(req.user._id).select('favorites');
  const favoriteIds = user.favorites;

  if (favoriteIds.length === 0) {
    return sendError(res, 'No favorites to clear', 400);
  }

  // Clear favorites
  await User.findByIdAndUpdate(req.user._id, {
    $set: { favorites: [] }
  });

  // Update favorites count for all products
  await Product.updateMany(
    { _id: { $in: favoriteIds } },
    { $inc: { favoritesCount: -1 } }
  );

  // Clear user cache
  await cache.del(`user:${req.user._id}`);

  logger.info(`All favorites cleared for user ${req.user._id}`);

  sendSuccess(res, 'All favorites cleared', {
    removed: favoriteIds.length
  });
}));

/**
 * @swagger
 * /api/favorites/stats:
 *   get:
 *     summary: Get user's favorites statistics
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Favorites statistics retrieved
 */
router.get('/stats', protect, asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    { $match: { _id: req.user._id } },
    { $unwind: '$favorites' },
    {
      $lookup: {
        from: 'products',
        localField: 'favorites',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    { $match: { 'product.status': 'active' } },
    {
      $group: {
        _id: '$product.category',
        count: { $sum: 1 },
        totalValue: { $sum: '$product.price' },
        avgPrice: { $avg: '$product.price' }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    { $unwind: '$categoryInfo' },
    {
      $project: {
        category: '$categoryInfo.name',
        count: 1,
        totalValue: { $round: ['$totalValue', 2] },
        avgPrice: { $round: ['$avgPrice', 2] }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const totalFavorites = await User.aggregate([
    { $match: { _id: req.user._id } },
    { $project: { favoritesCount: { $size: '$favorites' } } }
  ]);

  sendSuccess(res, 'Favorites statistics retrieved', {
    totalFavorites: totalFavorites[0]?.favoritesCount || 0,
    categoryBreakdown: stats
  });
}));

module.exports = router;
