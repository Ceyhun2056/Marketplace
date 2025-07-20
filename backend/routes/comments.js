const express = require('express');
const Comment = require('../models/Comment');
const Product = require('../models/Product');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, getPagination } = require('../utils/responseHandler');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createCommentValidation, mongoIdValidation, paginationValidation } = require('../validators');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/comments/product/{productId}:
 *   get:
 *     summary: Get comments for a product
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, rating, helpful]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/product/:productId', optionalAuth, mongoIdValidation, paginationValidation, validate, asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Check if product exists
  const product = await Product.findById(productId).select('title');
  
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Build sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [comments, total] = await Promise.all([
    Comment.find({ product: productId, status: 'approved' })
      .populate('user', 'username profile.firstName profile.lastName profile.avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Comment.countDocuments({ product: productId, status: 'approved' })
  ]);

  // Add user interaction flags if authenticated
  if (req.user) {
    for (let comment of comments) {
      comment._doc.isOwner = comment.user._id.toString() === req.user._id.toString();
      comment._doc.hasLiked = comment.likes.includes(req.user._id);
      comment._doc.hasDisliked = comment.dislikes.includes(req.user._id);
    }
  }

  const pagination = getPagination(page, limit, total);

  // Get comment statistics
  const stats = await Comment.aggregate([
    { $match: { product: productId, status: 'approved' } },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  const commentStats = stats[0] || { totalComments: 0, averageRating: 0 };
  
  if (commentStats.ratingDistribution) {
    const distribution = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: commentStats.ratingDistribution.filter(r => r === rating).length
    }));
    commentStats.ratingDistribution = distribution;
  }

  sendSuccess(res, 'Comments retrieved successfully', {
    comments,
    stats: commentStats,
    pagination
  });
}));

/**
 * @swagger
 * /api/comments/product/{productId}:
 *   post:
 *     summary: Add a comment to a product
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       400:
 *         description: Validation error or user already commented
 *       404:
 *         description: Product not found
 */
router.post('/product/:productId', protect, createCommentValidation, validate, asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { content, rating } = req.body;

  // Check if product exists and is active
  const product = await Product.findOne({ 
    _id: productId, 
    status: 'active' 
  }).populate('seller', 'username');

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if user is trying to comment on their own product
  if (product.seller._id.toString() === req.user._id.toString()) {
    return sendError(res, 'You cannot comment on your own product', 400);
  }

  // Check if user has already commented on this product
  const existingComment = await Comment.findOne({
    product: productId,
    user: req.user._id
  });

  if (existingComment) {
    return sendError(res, 'You have already commented on this product', 400);
  }

  // Create comment
  const comment = await Comment.create({
    content,
    rating,
    product: productId,
    user: req.user._id
  });

  // Populate user info
  await comment.populate('user', 'username profile.firstName profile.lastName profile.avatar');

  // Update product rating if rating was provided
  if (rating) {
    const allComments = await Comment.find({ 
      product: productId, 
      status: 'approved',
      rating: { $exists: true }
    }).select('rating');

    const totalRatings = allComments.length;
    const avgRating = allComments.reduce((sum, c) => sum + c.rating, 0) / totalRatings;

    await Product.findByIdAndUpdate(productId, {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: totalRatings
    });
  }

  // Update product comments count
  await Product.findByIdAndUpdate(productId, {
    $inc: { commentsCount: 1 }
  });

  // Clear product cache
  await cache.del(`product:${productId}`);

  // Emit socket event for real-time updates
  const io = req.app.get('io');
  io.to(`product_${productId}`).emit('newComment', {
    comment: {
      ...comment._doc,
      isOwner: false,
      hasLiked: false,
      hasDisliked: false
    }
  });

  // Notify product owner
  io.to(`user_${product.seller._id}`).emit('productCommented', {
    productId,
    productTitle: product.title,
    comment: content.substring(0, 100),
    rating,
    userId: req.user._id,
    username: req.user.username
  });

  logger.info(`New comment on product ${productId} by user ${req.user._id}`);

  sendSuccess(res, 'Comment created successfully', {
    ...comment._doc,
    isOwner: true,
    hasLiked: false,
    hasDisliked: false
  }, 201);
}));

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
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
 *             properties:
 *               content:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       403:
 *         description: Not authorized to update this comment
 *       404:
 *         description: Comment not found
 */
router.put('/:id', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  let comment = await Comment.findById(req.params.id);

  if (!comment) {
    return sendError(res, 'Comment not found', 404);
  }

  // Check if user owns the comment
  if (comment.user.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized to update this comment', 403);
  }

  // Update comment
  const updateFields = {};
  if (req.body.content) updateFields.content = req.body.content;
  if (req.body.rating) updateFields.rating = req.body.rating;
  updateFields.updatedAt = new Date();

  comment = await Comment.findByIdAndUpdate(
    req.params.id,
    updateFields,
    { new: true, runValidators: true }
  ).populate('user', 'username profile.firstName profile.lastName profile.avatar');

  // Update product rating if rating was changed
  if (req.body.rating) {
    const allComments = await Comment.find({ 
      product: comment.product, 
      status: 'approved',
      rating: { $exists: true }
    }).select('rating');

    const totalRatings = allComments.length;
    const avgRating = allComments.reduce((sum, c) => sum + c.rating, 0) / totalRatings;

    await Product.findByIdAndUpdate(comment.product, {
      rating: Math.round(avgRating * 10) / 10
    });
  }

  // Clear product cache
  await cache.del(`product:${comment.product}`);

  logger.info(`Comment ${req.params.id} updated by user ${req.user._id}`);

  sendSuccess(res, 'Comment updated successfully', comment);
}));

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
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
 *         description: Comment deleted successfully
 *       403:
 *         description: Not authorized to delete this comment
 *       404:
 *         description: Comment not found
 */
router.delete('/:id', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return sendError(res, 'Comment not found', 404);
  }

  // Check if user owns the comment or is admin/moderator
  if (comment.user.toString() !== req.user._id.toString() && 
      !['admin', 'moderator'].includes(req.user.role)) {
    return sendError(res, 'Not authorized to delete this comment', 403);
  }

  // Soft delete - update status instead of removing
  await Comment.findByIdAndUpdate(req.params.id, { 
    status: 'deleted',
    deletedAt: new Date()
  });

  // Update product comments count
  await Product.findByIdAndUpdate(comment.product, {
    $inc: { commentsCount: -1 }
  });

  // Recalculate product rating if comment had rating
  if (comment.rating) {
    const remainingComments = await Comment.find({ 
      product: comment.product, 
      status: 'approved',
      rating: { $exists: true },
      _id: { $ne: comment._id }
    }).select('rating');

    if (remainingComments.length > 0) {
      const avgRating = remainingComments.reduce((sum, c) => sum + c.rating, 0) / remainingComments.length;
      await Product.findByIdAndUpdate(comment.product, {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: remainingComments.length
      });
    } else {
      await Product.findByIdAndUpdate(comment.product, {
        rating: 0,
        reviewCount: 0
      });
    }
  }

  // Clear product cache
  await cache.del(`product:${comment.product}`);

  logger.info(`Comment ${req.params.id} deleted by user ${req.user._id}`);

  sendSuccess(res, 'Comment deleted successfully');
}));

/**
 * @swagger
 * /api/comments/{id}/like:
 *   post:
 *     summary: Like a comment
 *     tags: [Comments]
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
 *         description: Comment liked successfully
 *       400:
 *         description: Comment already liked
 *       404:
 *         description: Comment not found
 */
router.post('/:id/like', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return sendError(res, 'Comment not found', 404);
  }

  // Check if user already liked the comment
  if (comment.likes.includes(req.user._id)) {
    return sendError(res, 'Comment already liked', 400);
  }

  // Remove from dislikes if present and add to likes
  await Comment.findByIdAndUpdate(req.params.id, {
    $pull: { dislikes: req.user._id },
    $push: { likes: req.user._id }
  });

  // Get updated like/dislike counts
  const updatedComment = await Comment.findById(req.params.id).select('likes dislikes');

  logger.info(`Comment ${req.params.id} liked by user ${req.user._id}`);

  sendSuccess(res, 'Comment liked successfully', {
    likes: updatedComment.likes.length,
    dislikes: updatedComment.dislikes.length,
    hasLiked: true,
    hasDisliked: false
  });
}));

/**
 * @swagger
 * /api/comments/{id}/dislike:
 *   post:
 *     summary: Dislike a comment
 *     tags: [Comments]
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
 *         description: Comment disliked successfully
 *       400:
 *         description: Comment already disliked
 *       404:
 *         description: Comment not found
 */
router.post('/:id/dislike', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return sendError(res, 'Comment not found', 404);
  }

  // Check if user already disliked the comment
  if (comment.dislikes.includes(req.user._id)) {
    return sendError(res, 'Comment already disliked', 400);
  }

  // Remove from likes if present and add to dislikes
  await Comment.findByIdAndUpdate(req.params.id, {
    $pull: { likes: req.user._id },
    $push: { dislikes: req.user._id }
  });

  // Get updated like/dislike counts
  const updatedComment = await Comment.findById(req.params.id).select('likes dislikes');

  logger.info(`Comment ${req.params.id} disliked by user ${req.user._id}`);

  sendSuccess(res, 'Comment disliked successfully', {
    likes: updatedComment.likes.length,
    dislikes: updatedComment.dislikes.length,
    hasLiked: false,
    hasDisliked: true
  });
}));

/**
 * @swagger
 * /api/comments/{id}/moderate:
 *   put:
 *     summary: Moderate a comment (admin/moderator only)
 *     tags: [Comments]
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
 *                 enum: [pending, approved, rejected]
 *               moderationNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comment moderated successfully
 *       404:
 *         description: Comment not found
 */
router.put('/:id/moderate', protect, authorize('admin', 'moderator'), mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { status, moderationNote } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return sendError(res, 'Invalid status value', 400);
  }

  const comment = await Comment.findByIdAndUpdate(
    req.params.id,
    {
      status,
      moderatedBy: req.user._id,
      moderatedAt: new Date(),
      ...(moderationNote && { moderationNote })
    },
    { new: true }
  ).populate('user', 'username profile.firstName profile.lastName profile.avatar')
   .populate('moderatedBy', 'username');

  if (!comment) {
    return sendError(res, 'Comment not found', 404);
  }

  logger.info(`Comment ${req.params.id} moderated: ${status} by ${req.user.username}`);

  sendSuccess(res, 'Comment moderated successfully', comment);
}));

module.exports = router;
