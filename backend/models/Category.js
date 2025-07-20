const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Category name must be at least 2 characters'],
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  slug: {
    type: String,
    required: [true, 'Category slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  description: {
    type: String,
    maxlength: [200, 'Category description cannot exceed 200 characters'],
    trim: true
  },
  icon: {
    type: String,
    trim: true
  },
  parentCategory: {
    type: mongoose.Schema.ObjectId,
    ref: 'Category',
    default: null
  },
  subcategories: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Category'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'deleted'],
    default: 'active'
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  metadata: {
    keywords: [String],
    color: String,
    image: String
  },
  stats: {
    productCount: {
      type: Number,
      default: 0
    },
    activeProductCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full hierarchy path
categorySchema.virtual('path').get(function() {
  if (this.parentCategory) {
    return `${this.parentCategory.name} > ${this.name}`;
  }
  return this.name;
});

// Virtual for product count (computed from actual products)
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Indexes for efficient querying
categorySchema.index({ slug: 1 });
categorySchema.index({ status: 1, sortOrder: 1 });
categorySchema.index({ parentCategory: 1, status: 1 });
categorySchema.index({ name: 'text', description: 'text' });

// Pre-save middleware to generate slug if not provided
categorySchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

// Pre-remove middleware to handle cascading deletions
categorySchema.pre('remove', async function(next) {
  // Check if category has products
  const Product = mongoose.model('Product');
  const productCount = await Product.countDocuments({ category: this._id });
  
  if (productCount > 0) {
    const error = new Error('Cannot delete category with existing products');
    error.statusCode = 400;
    return next(error);
  }

  // Update subcategories to remove parent reference
  await this.constructor.updateMany(
    { parentCategory: this._id },
    { $unset: { parentCategory: 1 } }
  );

  next();
});

// Method to get category hierarchy
categorySchema.methods.getHierarchy = async function() {
  const hierarchy = [this];
  let current = this;
  
  while (current.parentCategory) {
    current = await this.constructor.findById(current.parentCategory);
    if (current) {
      hierarchy.unshift(current);
    } else {
      break;
    }
  }
  
  return hierarchy;
};

// Method to get all subcategories (recursive)
categorySchema.methods.getAllSubcategories = async function() {
  const subcategories = [];
  
  const directSubs = await this.constructor.find({ 
    parentCategory: this._id,
    status: 'active'
  });
  
  for (const sub of directSubs) {
    subcategories.push(sub);
    const subSubs = await sub.getAllSubcategories();
    subcategories.push(...subSubs);
  }
  
  return subcategories;
};

// Static method to get category tree
categorySchema.statics.getCategoryTree = function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    {
      $graphLookup: {
        from: 'categories',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentCategory',
        as: 'subcategories',
        maxDepth: 3
      }
    },
    { $match: { parentCategory: null } },
    { $sort: { sortOrder: 1, name: 1 } }
  ]);
};

// Static method to get popular categories
categorySchema.statics.getPopularCategories = function(limit = 10) {
  return this.aggregate([
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
    { $limit: limit },
    {
      $project: {
        name: 1,
        slug: 1,
        icon: 1,
        description: 1,
        activeProductCount: 1
      }
    }
  ]);
};

// Method to update product count
categorySchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  
  const [total, active] = await Promise.all([
    Product.countDocuments({ category: this._id }),
    Product.countDocuments({ category: this._id, status: 'active' })
  ]);

  this.stats.productCount = total;
  this.stats.activeProductCount = active;
  
  await this.save();
  return this;
};

module.exports = mongoose.model('Category', categorySchema);
