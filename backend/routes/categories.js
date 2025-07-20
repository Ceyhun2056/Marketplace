const express = require('express');
const Category = require('../models/Category');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, getPagination } = require('../utils/responseHandler');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { mongoIdValidation, paginationValidation } = require('../validators');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: includeProductCount
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/', asyncHandler(async (req, res) => {
  const { includeProductCount } = req.query;

  // Check cache first
  const cacheKey = includeProductCount ? 'categories_with_count' : 'categories';
  let categories = await cache.get(cacheKey);

  if (!categories) {
    if (includeProductCount === 'true') {
      categories = await Category.aggregate([
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: 'category',
            as: 'products'
          }
        },
        {
          $addFields: {
            productCount: {
              $size: {
                $filter: {
                  input: '$products',
                  as: 'product',
                  cond: { $eq: ['$$product.status', 'active'] }
                }
              }
            }
          }
        },
        {
          $project: {
            products: 0
          }
        },
        {
          $sort: { name: 1 }
        }
      ]);
    } else {
      categories = await Category.find({ status: 'active' })
        .sort({ name: 1 })
        .select('name slug description icon');
    }

    // Cache for 1 hour
    await cache.set(cacheKey, categories, 3600);
  }

  sendSuccess(res, 'Categories retrieved successfully', categories);
}));

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get('/:id', mongoIdValidation, validate, asyncHandler(async (req, res) => {
  // Check cache first
  let category = await cache.get(`category:${req.params.id}`);

  if (!category) {
    category = await Category.findOne({ 
      _id: req.params.id, 
      status: 'active' 
    });

    if (!category) {
      return sendError(res, 'Category not found', 404);
    }

    // Cache for 30 minutes
    await cache.set(`category:${req.params.id}`, category, 1800);
  }

  // Get recent products in this category
  const recentProducts = await Product.find({ 
    category: req.params.id, 
    status: 'active' 
  })
    .populate('seller', 'username profile.firstName profile.lastName profile.avatar')
    .sort({ createdAt: -1 })
    .limit(8)
    .select('title images price condition createdAt');

  sendSuccess(res, 'Category retrieved successfully', {
    ...category._doc,
    recentProducts
  });
}));

/**
 * @swagger
 * /api/categories/{slug}/products:
 *   get:
 *     summary: Get products by category slug
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
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
 *       - in: query
 *         name: sortOrder
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
 *     responses:
 *       200:
 *         description: Category products retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get('/:slug/products', paginationValidation, validate, asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 12, 
    sortBy = 'createdAt',
    sortOrder = 'desc',
    minPrice,
    maxPrice,
    condition
  } = req.query;

  // Find category by slug
  const category = await Category.findOne({ 
    slug: req.params.slug, 
    status: 'active' 
  });

  if (!category) {
    return sendError(res, 'Category not found', 404);
  }

  // Build query
  const query = { 
    category: category._id, 
    status: 'active' 
  };

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
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  const pagination = getPagination(page, limit, total);

  sendSuccess(res, 'Category products retrieved successfully', {
    category,
    products,
    pagination
  });
}));

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category (admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *               parentCategory:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Validation error or category already exists
 */
router.post('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, slug, description, icon, parentCategory } = req.body;

  // Check if category with same name or slug already exists
  const existingCategory = await Category.findOne({
    $or: [{ name }, { slug }]
  });

  if (existingCategory) {
    return sendError(res, 'Category with this name or slug already exists', 400);
  }

  // If parentCategory is provided, check if it exists
  if (parentCategory) {
    const parent = await Category.findById(parentCategory);
    if (!parent) {
      return sendError(res, 'Parent category not found', 400);
    }
  }

  const category = await Category.create({
    name,
    slug,
    description,
    icon,
    ...(parentCategory && { parentCategory })
  });

  // Populate parent category if exists
  if (category.parentCategory) {
    await category.populate('parentCategory', 'name slug');
  }

  // Clear categories cache
  await cache.del('categories');
  await cache.del('categories_with_count');

  logger.info(`New category created: ${category.name}`);

  sendSuccess(res, 'Category created successfully', category, 201);
}));

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update category (admin only)
 *     tags: [Categories]
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
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
router.put('/:id', protect, authorize('admin'), mongoIdValidation, validate, asyncHandler(async (req, res) => {
  let category = await Category.findById(req.params.id);

  if (!category) {
    return sendError(res, 'Category not found', 404);
  }

  // If updating slug, check for conflicts
  if (req.body.slug && req.body.slug !== category.slug) {
    const existingCategory = await Category.findOne({ 
      slug: req.body.slug,
      _id: { $ne: req.params.id }
    });

    if (existingCategory) {
      return sendError(res, 'Category with this slug already exists', 400);
    }
  }

  category = await Category.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('parentCategory', 'name slug');

  // Clear caches
  await cache.del('categories');
  await cache.del('categories_with_count');
  await cache.del(`category:${req.params.id}`);

  logger.info(`Category updated: ${category.name}`);

  sendSuccess(res, 'Category updated successfully', category);
}));

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete category (admin only)
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 *       400:
 *         description: Cannot delete category with products
 *       404:
 *         description: Category not found
 */
router.delete('/:id', protect, authorize('admin'), mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return sendError(res, 'Category not found', 404);
  }

  // Check if category has active products
  const productCount = await Product.countDocuments({ 
    category: req.params.id, 
    status: 'active' 
  });

  if (productCount > 0) {
    return sendError(res, 'Cannot delete category with active products', 400);
  }

  // Check if category has subcategories
  const subcategoryCount = await Category.countDocuments({ 
    parentCategory: req.params.id,
    status: 'active'
  });

  if (subcategoryCount > 0) {
    return sendError(res, 'Cannot delete category with subcategories', 400);
  }

  // Soft delete - update status instead of removing
  await Category.findByIdAndUpdate(req.params.id, { status: 'deleted' });

  // Clear caches
  await cache.del('categories');
  await cache.del('categories_with_count');
  await cache.del(`category:${req.params.id}`);

  logger.info(`Category deleted: ${category.name}`);

  sendSuccess(res, 'Category deleted successfully');
}));

/**
 * @swagger
 * /api/categories/stats:
 *   get:
 *     summary: Get category statistics (admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category statistics retrieved successfully
 */
router.get('/admin/stats', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const stats = await Category.aggregate([
    {
      $match: { status: 'active' }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: 'category',
        as: 'products'
      }
    },
    {
      $addFields: {
        productCount: {
          $size: {
            $filter: {
              input: '$products',
              as: 'product',
              cond: { $eq: ['$$product.status', 'active'] }
            }
          }
        }
      }
    },
    {
      $project: {
        name: 1,
        slug: 1,
        productCount: 1,
        createdAt: 1
      }
    },
    {
      $sort: { productCount: -1 }
    },
    {
      $limit: 10
    }
  ]);

  const totalCategories = await Category.countDocuments({ status: 'active' });
  const totalProducts = await Product.countDocuments({ status: 'active' });

  sendSuccess(res, 'Category statistics retrieved successfully', {
    totalCategories,
    totalProducts,
    topCategories: stats
  });
}));

module.exports = router;
