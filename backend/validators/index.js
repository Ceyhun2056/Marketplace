const { body, param, query } = require('express-validator');

// User validation schemas
exports.registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('firstName')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2-50 characters'),
  
  body('lastName')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2-50 characters')
];

exports.loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Product validation schemas
exports.createProductValidation = [
  body('title')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3-100 characters'),
  
  body('description')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10-2000 characters'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('category')
    .isMongoId()
    .withMessage('Please provide a valid category ID'),
  
  body('condition')
    .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
    .withMessage('Condition must be one of: new, like-new, good, fair, poor'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage('Each tag must be between 1-20 characters')
];

exports.updateProductValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid product ID'),
  
  body('title')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3-100 characters'),
  
  body('description')
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10-2000 characters'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('condition')
    .optional()
    .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
    .withMessage('Condition must be one of: new, like-new, good, fair, poor')
];

// Comment validation schemas
exports.createCommentValidation = [
  param('productId')
    .isMongoId()
    .withMessage('Please provide a valid product ID'),
  
  body('content')
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1-500 characters'),
  
  body('rating')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1-5')
];

// General validation schemas
exports.mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid ID')
];

exports.paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100')
];

exports.searchValidation = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1-100 characters'),
  
  query('category')
    .optional()
    .isMongoId()
    .withMessage('Category must be a valid ID'),
  
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number'),
  
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number'),
  
  query('condition')
    .optional()
    .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
    .withMessage('Condition must be one of: new, like-new, good, fair, poor'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'price', 'title', 'rating'])
    .withMessage('SortBy must be one of: createdAt, price, title, rating'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('SortOrder must be either asc or desc')
];
