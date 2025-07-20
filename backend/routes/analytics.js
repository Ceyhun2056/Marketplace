const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Comment = require('../models/Comment');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { protect, authorize } = require('../middleware/auth');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard analytics retrieved successfully
 */
router.get('/dashboard', protect, authorize('admin'), asyncHandler(async (req, res) => {
  // Check cache first
  let dashboardData = await cache.get('dashboard_analytics');

  if (!dashboardData) {
    // Get current date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get overview statistics
    const [
      totalUsers,
      newUsers30d,
      newUsers7d,
      newUsersToday,
      totalProducts,
      newProducts30d,
      newProducts7d,
      newProductsToday,
      activeProducts,
      soldProducts,
      totalComments,
      newComments7d,
      totalCategories
    ] = await Promise.all([
      User.countDocuments({ status: { $ne: 'deleted' } }),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: { $ne: 'deleted' } }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'deleted' } }),
      User.countDocuments({ createdAt: { $gte: yesterday }, status: { $ne: 'deleted' } }),
      Product.countDocuments({ status: { $ne: 'deleted' } }),
      Product.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: { $ne: 'deleted' } }),
      Product.countDocuments({ createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'deleted' } }),
      Product.countDocuments({ createdAt: { $gte: yesterday }, status: { $ne: 'deleted' } }),
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ status: 'sold' }),
      Comment.countDocuments({ status: 'approved' }),
      Comment.countDocuments({ createdAt: { $gte: sevenDaysAgo }, status: 'approved' }),
      Category.countDocuments({ status: 'active' })
    ]);

    // Get user growth data (last 30 days)
    const userGrowth = await User.aggregate([
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

    // Get product creation data (last 30 days)
    const productGrowth = await Product.aggregate([
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

    // Get top categories by product count
    const topCategories = await Category.aggregate([
      { $match: { status: 'active' } },
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
          activeProductCount: {
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
      { $sort: { activeProductCount: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          slug: 1,
          activeProductCount: 1
        }
      }
    ]);

    // Get recent activity
    const recentUsers = await User.find({ status: { $ne: 'deleted' } })
      .select('username email createdAt profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentProducts = await Product.find({ status: { $ne: 'deleted' } })
      .populate('seller', 'username')
      .populate('category', 'name')
      .select('title price status createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get user role distribution
    const userRoleDistribution = await User.aggregate([
      { $match: { status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get product status distribution
    const productStatusDistribution = await Product.aggregate([
      { $match: { status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    dashboardData = {
      overview: {
        users: {
          total: totalUsers,
          new30d: newUsers30d,
          new7d: newUsers7d,
          newToday: newUsersToday
        },
        products: {
          total: totalProducts,
          new30d: newProducts30d,
          new7d: newProducts7d,
          newToday: newProductsToday,
          active: activeProducts,
          sold: soldProducts
        },
        comments: {
          total: totalComments,
          new7d: newComments7d
        },
        categories: {
          total: totalCategories
        }
      },
      charts: {
        userGrowth,
        productGrowth,
        userRoleDistribution,
        productStatusDistribution
      },
      topCategories,
      recentActivity: {
        users: recentUsers,
        products: recentProducts
      }
    };

    // Cache for 10 minutes
    await cache.set('dashboard_analytics', dashboardData, 600);
  }

  sendSuccess(res, 'Dashboard analytics retrieved successfully', dashboardData);
}));

/**
 * @swagger
 * /api/analytics/users:
 *   get:
 *     summary: Get user analytics (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *     responses:
 *       200:
 *         description: User analytics retrieved successfully
 */
router.get('/users', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Get user registration trends
  const registrationTrends = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
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

  // Get user activity statistics
  const activityStats = await User.aggregate([
    { $match: { status: { $ne: 'deleted' } } },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        avgProductsPerUser: { $avg: { $size: '$products' } },
        avgFavoritesPerUser: { $avg: { $size: '$favorites' } }
      }
    }
  ]);

  // Get top users by products
  const topSellersByProducts = await User.aggregate([
    { $match: { status: { $ne: 'deleted' } } },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: 'seller',
        as: 'userProducts'
      }
    },
    {
      $addFields: {
        productCount: { $size: '$userProducts' }
      }
    },
    { $match: { productCount: { $gt: 0 } } },
    { $sort: { productCount: -1 } },
    { $limit: 10 },
    {
      $project: {
        username: 1,
        'profile.firstName': 1,
        'profile.lastName': 1,
        productCount: 1,
        createdAt: 1
      }
    }
  ]);

  sendSuccess(res, 'User analytics retrieved successfully', {
    period,
    registrationTrends,
    activityStats: activityStats[0] || {},
    topSellersByProducts
  });
}));

/**
 * @swagger
 * /api/analytics/products:
 *   get:
 *     summary: Get product analytics (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *     responses:
 *       200:
 *         description: Product analytics retrieved successfully
 */
router.get('/products', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Get product creation trends
  const creationTrends = await Product.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
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

  // Get price distribution
  const priceDistribution = await Product.aggregate([
    { $match: { status: 'active' } },
    {
      $bucket: {
        groupBy: '$price',
        boundaries: [0, 50, 100, 250, 500, 1000, 5000],
        default: '5000+',
        output: {
          count: { $sum: 1 }
        }
      }
    }
  ]);

  // Get most viewed products
  const mostViewedProducts = await Product.find({ status: 'active' })
    .populate('seller', 'username')
    .populate('category', 'name')
    .select('title price views favoritesCount createdAt')
    .sort({ views: -1 })
    .limit(10);

  // Get most favorited products
  const mostFavoritedProducts = await Product.find({ status: 'active' })
    .populate('seller', 'username')
    .populate('category', 'name')
    .select('title price views favoritesCount createdAt')
    .sort({ favoritesCount: -1 })
    .limit(10);

  // Get category performance
  const categoryPerformance = await Product.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        totalViews: { $sum: '$views' },
        totalFavorites: { $sum: '$favoritesCount' }
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
        avgPrice: { $round: ['$avgPrice', 2] },
        totalViews: 1,
        totalFavorites: 1
      }
    },
    { $sort: { count: -1 } }
  ]);

  sendSuccess(res, 'Product analytics retrieved successfully', {
    period,
    creationTrends,
    priceDistribution,
    mostViewedProducts,
    mostFavoritedProducts,
    categoryPerformance
  });
}));

/**
 * @swagger
 * /api/analytics/search:
 *   get:
 *     summary: Get search analytics (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Search analytics retrieved successfully
 */
router.get('/search', protect, authorize('admin'), asyncHandler(async (req, res) => {
  // This would typically be stored in a separate search analytics collection
  // For now, return mock data structure
  const searchData = {
    topSearchTerms: [
      { term: 'laptop', count: 145 },
      { term: 'phone', count: 98 },
      { term: 'camera', count: 76 },
      { term: 'book', count: 54 },
      { term: 'furniture', count: 43 }
    ],
    searchTrends: [
      { date: '2025-06-15', searches: 234 },
      { date: '2025-06-16', searches: 198 },
      { date: '2025-06-17', searches: 267 },
      { date: '2025-06-18', searches: 223 },
      { date: '2025-06-19', searches: 189 },
      { date: '2025-06-20', searches: 245 },
      { date: '2025-06-21', searches: 278 }
    ],
    noResultsSearches: [
      { term: 'vintage typewriter', count: 12 },
      { term: 'rare coins', count: 8 },
      { term: 'antique furniture', count: 6 }
    ]
  };

  sendSuccess(res, 'Search analytics retrieved successfully', searchData);
}));

/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     summary: Export analytics data (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [users, products, comments, all]
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *     responses:
 *       200:
 *         description: Analytics data exported successfully
 */
router.get('/export', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { type = 'all', period = '30d', format = 'json' } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const exportData = {};

  // Export users data
  if (type === 'users' || type === 'all') {
    exportData.users = await User.find({
      createdAt: { $gte: startDate },
      status: { $ne: 'deleted' }
    }).select('username email role status createdAt lastLogin');
  }

  // Export products data
  if (type === 'products' || type === 'all') {
    exportData.products = await Product.find({
      createdAt: { $gte: startDate },
      status: { $ne: 'deleted' }
    })
      .populate('seller', 'username')
      .populate('category', 'name')
      .select('title price status views favoritesCount createdAt');
  }

  // Export comments data
  if (type === 'comments' || type === 'all') {
    exportData.comments = await Comment.find({
      createdAt: { $gte: startDate },
      status: 'approved'
    })
      .populate('user', 'username')
      .populate('product', 'title')
      .select('content rating createdAt');
  }

  // Set appropriate headers for download
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-${type}-${period}.json`);
  }

  logger.info(`Analytics data exported: ${type} for ${period} by ${req.user.username}`);

  sendSuccess(res, 'Analytics data exported successfully', {
    exportInfo: {
      type,
      period,
      format,
      exportedAt: new Date(),
      recordCount: Object.keys(exportData).reduce((sum, key) => sum + (exportData[key]?.length || 0), 0)
    },
    data: exportData
  });
}));

module.exports = router;
