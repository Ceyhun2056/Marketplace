const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: ['electronics', 'books', 'clothing', 'home', 'sports', 'transport', 'services', 'other']
  },
  subcategory: {
    type: String,
    trim: true
  },
  condition: {
    type: String,
    enum: ['new', 'like-new', 'good', 'fair', 'poor'],
    default: 'good'
  },
  location: {
    city: { type: String, default: 'Baku' },
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  seller: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  images: [{
    url: String,
    publicId: String,
    alt: String
  }],
  tags: [String],
  status: {
    type: String,
    enum: ['active', 'sold', 'inactive', 'pending'],
    default: 'active'
  },
  stock: {
    type: Number,
    default: 1,
    min: 0
  },
  views: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  boosted: {
    until: Date,
    level: {
      type: Number,
      enum: [1, 2, 3],
      default: 1
    }
  },
  specifications: {
    brand: String,
    model: String,
    year: Number,
    color: String,
    size: String,
    weight: String,
    dimensions: String,
    material: String,
    warranty: String
  },
  shipping: {
    available: { type: Boolean, default: false },
    cost: { type: Number, default: 0 },
    methods: [String]
  },
  negotiable: {
    type: Boolean,
    default: true
  },
  urgent: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
productSchema.index({ title: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ location: '2dsphere' });
productSchema.index({ createdAt: -1 });
productSchema.index({ price: 1 });
productSchema.index({ views: -1 });

// Virtual for favorites count
productSchema.virtual('favoritesCount', {
  ref: 'Favorite',
  localField: '_id',
  foreignField: 'product',
  count: true
});

// Virtual for comments
productSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'product'
});

// Middleware to populate seller info
productSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'seller',
    select: 'name avatar location rating'
  });
  next();
});

// Method to increment views
productSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('Product', productSchema);
