const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const Product = require('../models/Product');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, getPagination } = require('../utils/responseHandler');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { 
  createProductValidation, 
  updateProductValidation, 
  mongoIdValidation,
  paginationValidation,
  searchValidation
} = require('../validators');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

// Multer configuration for product images
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload image files only'), false);
    }
  }
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products with filtering and pagination
 *     tags: [Products]
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
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: condition
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get('/', optionalAuth, paginationValidation, searchValidation, validate, asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 12, 
    q, 
    category, 
    minPrice, 
    maxPrice, 
    condition,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = { status: 'active' };

  // Text search
  if (q) {
    query.$or = [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { tags: { $in: [new RegExp(q, 'i')] } }
    ];
  }

  // Category filter
  if (category) {
    query.category = category;
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Condition filter
  if (condition) {
    query.condition = condition;
  }

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('seller', 'username profile.firstName profile.lastName profile.avatar rating')
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  // Add isFavorite field if user is authenticated
  if (req.user) {
    const userFavorites = req.user.favorites || [];
    products.forEach(product => {
      product._doc.isFavorite = userFavorites.includes(product._id.toString());
    });
  }

  const pagination = getPagination(page, limit, total);

  sendSuccess(res, 'Products retrieved successfully', products, 200, pagination);
}));

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/:id', optionalAuth, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  // Check cache first
  let product = await cache.get(`product:${req.params.id}`);
  
  if (!product) {
    product = await Product.findOne({ _id: req.params.id, status: 'active' })
      .populate('seller', 'username profile rating reviewCount createdAt')
      .populate('category', 'name slug')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username profile.firstName profile.lastName profile.avatar'
        },
        options: { sort: { createdAt: -1 }, limit: 10 }
      });

    if (!product) {
      return sendError(res, 'Product not found', 404);
    }

    // Cache for 15 minutes
    await cache.set(`product:${req.params.id}`, product, 900);
  }

  // Increment view count
  await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

  // Add isFavorite field if user is authenticated
  if (req.user) {
    const userFavorites = req.user.favorites || [];
    product._doc.isFavorite = userFavorites.includes(product._id.toString());
  }

  // Get related products
  const relatedProducts = await Product.find({
    _id: { $ne: product._id },
    category: product.category._id,
    status: 'active'
  })
    .populate('seller', 'username profile.firstName profile.lastName profile.avatar')
    .limit(4)
    .select('title images price condition createdAt');

  sendSuccess(res, 'Product retrieved successfully', {
    ...product._doc,
    relatedProducts
  });
}));

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
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
 *               - description
 *               - price
 *               - category
 *               - condition
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               condition:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', protect, createProductValidation, validate, asyncHandler(async (req, res) => {
  const productData = {
    ...req.body,
    seller: req.user._id
  };

  const product = await Product.create(productData);

  // Populate the created product
  await product.populate([
    { path: 'seller', select: 'username profile' },
    { path: 'category', select: 'name slug' }
  ]);

  // Update user's products array
  await User.findByIdAndUpdate(req.user._id, {
    $push: { products: product._id }
  });

  // Emit socket event for new product
  const io = req.app.get('io');
  io.emit('newProduct', {
    id: product._id,
    title: product.title,
    price: product.price,
    category: product.category.name,
    seller: product.seller.username
  });

  logger.info(`New product created: ${product.title} by ${req.user.username}`);

  sendSuccess(res, 'Product created successfully', product, 201);
}));

/**
 * @swagger
 * /api/products/{id}/images:
 *   post:
 *     summary: Upload product images
 *     tags: [Products]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       404:
 *         description: Product not found
 */
router.post('/:id/images', protect, mongoIdValidation, validate, upload.array('images', 5), asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if user owns the product
  if (product.seller.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized to upload images for this product', 403);
  }

  if (!req.files || req.files.length === 0) {
    return sendError(res, 'Please upload at least one image', 400);
  }

  // Process images
  const processedImages = await Promise.all(
    req.files.map(async (file) => {
      const processedImage = await sharp(file.buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Convert to base64 for storage (in production, use cloud storage)
      return `data:image/jpeg;base64,${processedImage.toString('base64')}`;
    })
  );

  // Update product with new images
  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    { $push: { images: { $each: processedImages } } },
    { new: true }
  ).populate([
    { path: 'seller', select: 'username profile' },
    { path: 'category', select: 'name slug' }
  ]);

  // Clear cache
  await cache.del(`product:${req.params.id}`);

  logger.info(`Images uploaded for product: ${product.title}`);

  sendSuccess(res, 'Images uploaded successfully', {
    images: updatedProduct.images
  });
}));

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               condition:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
router.put('/:id', protect, updateProductValidation, validate, asyncHandler(async (req, res) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if user owns the product or is admin
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 'Not authorized to update this product', 403);
  }

  product = await Product.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate([
    { path: 'seller', select: 'username profile' },
    { path: 'category', select: 'name slug' }
  ]);

  // Clear cache
  await cache.del(`product:${req.params.id}`);

  logger.info(`Product updated: ${product.title}`);

  sendSuccess(res, 'Product updated successfully', product);
}));

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product
 *     tags: [Products]
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
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */
router.delete('/:id', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if user owns the product or is admin
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 'Not authorized to delete this product', 403);
  }

  // Soft delete - update status instead of removing
  await Product.findByIdAndUpdate(req.params.id, { status: 'deleted' });

  // Remove from user's products array
  await User.findByIdAndUpdate(product.seller, {
    $pull: { products: product._id }
  });

  // Clear cache
  await cache.del(`product:${req.params.id}`);

  logger.info(`Product deleted: ${product.title}`);

  sendSuccess(res, 'Product deleted successfully');
}));

/**
 * @swagger
 * /api/products/{id}/status:
 *   put:
 *     summary: Update product status
 *     tags: [Products]
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
 *                 enum: [active, sold, inactive, deleted]
 *     responses:
 *       200:
 *         description: Product status updated successfully
 *       404:
 *         description: Product not found
 */
router.put('/:id/status', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!['active', 'sold', 'inactive', 'deleted'].includes(status)) {
    return sendError(res, 'Invalid status value', 400);
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if user owns the product or is admin/moderator
  if (product.seller.toString() !== req.user._id.toString() && 
      !['admin', 'moderator'].includes(req.user.role)) {
    return sendError(res, 'Not authorized to update this product status', 403);
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate([
    { path: 'seller', select: 'username profile' },
    { path: 'category', select: 'name slug' }
  ]);

  // Clear cache
  await cache.del(`product:${req.params.id}`);

  logger.info(`Product status updated: ${product.title} -> ${status}`);

  sendSuccess(res, 'Product status updated successfully', updatedProduct);
}));

/**
 * @swagger
 * /api/products/my:
 *   get:
 *     summary: Get user's products
 *     tags: [Products]
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
 *         description: User products retrieved successfully
 */
router.get('/my/products', protect, paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const query = { seller: req.user._id };
  
  if (status && status !== 'all') {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  const pagination = getPagination(page, limit, total);

  sendSuccess(res, 'User products retrieved successfully', products, 200, pagination);
}));

module.exports = router;
