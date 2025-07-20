const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Comment must belong to a user']
  },
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: [true, 'Comment must belong to a product']
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    minlength: [1, 'Comment must be at least 1 character'],
    maxlength: [500, 'Comment cannot exceed 500 characters'],
    trim: true
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: function(value) {
        return value === null || value === undefined || (value >= 1 && value <= 5);
      },
      message: 'Rating must be between 1 and 5'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'deleted'],
    default: 'approved' // Auto-approve for now, can be changed to 'pending' for moderation
  },
  likes: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  moderatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  moderationNote: {
    type: String,
    maxlength: [200, 'Moderation note cannot exceed 200 characters']
  },
  deletedAt: {
    type: Date
  },
  helpfulCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for likes count
commentSchema.virtual('likesCount').get(function() {
  return this.likes.length;
});

// Virtual for dislikes count
commentSchema.virtual('dislikesCount').get(function() {
  return this.dislikes.length;
});

// Virtual for net score (likes - dislikes)
commentSchema.virtual('score').get(function() {
  return this.likes.length - this.dislikes.length;
});

// Index for efficient querying
commentSchema.index({ product: 1, status: 1, createdAt: -1 });
commentSchema.index({ user: 1, product: 1 }, { unique: true, partialFilterExpression: { status: { $ne: 'deleted' } } });
commentSchema.index({ status: 1, createdAt: -1 });
commentSchema.index({ rating: 1 });

// Middleware to update editedAt when content is modified
commentSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  next();
});

// Middleware to populate user info
commentSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'user',
    select: 'username profile.firstName profile.lastName profile.avatar'
  });
  next();
});

// Method to check if user has liked the comment
commentSchema.methods.hasUserLiked = function(userId) {
  return this.likes.includes(userId);
};

// Method to check if user has disliked the comment
commentSchema.methods.hasUserDisliked = function(userId) {
  return this.dislikes.includes(userId);
};

// Static method to get comment stats for a product
commentSchema.statics.getProductStats = function(productId) {
  return this.aggregate([
    { $match: { product: productId, status: 'approved' } },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratings: { $push: '$rating' }
      }
    }
  ]);
};

module.exports = mongoose.model('Comment', commentSchema);
