const mongoose = require('mongoose');

// Category Model
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  icon: String,
  description: String,
  parent: {
    type: mongoose.Schema.ObjectId,
    ref: 'Category',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Favorite Model
const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  }
}, { 
  timestamps: true,
  // Compound index to ensure one favorite per user per product
  index: [{ user: 1, product: 1 }, { unique: true }]
});

// Comment/Review Model
const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  comment: {
    type: String,
    required: [true, 'Comment text is required'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isReported: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Populate user info in comments
commentSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'user',
    select: 'name avatar'
  });
  next();
});

// Message Model for Chat
const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'offer'],
    default: 'text'
  },
  offer: {
    price: Number,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending'
    },
    expiresAt: Date
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Conversation Model
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product'
  },
  lastMessage: {
    type: mongoose.Schema.ObjectId,
    ref: 'Message'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, { timestamps: true });

// Notification Model
const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['message', 'favorite', 'comment', 'offer', 'system', 'product_sold'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    productId: mongoose.Schema.ObjectId,
    conversationId: mongoose.Schema.ObjectId,
    offerId: mongoose.Schema.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date
}, { timestamps: true });

// Analytics Model
const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  users: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    active: { type: Number, default: 0 }
  },
  products: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    sold: { type: Number, default: 0 }
  },
  pageViews: { type: Number, default: 0 },
  searches: {
    count: { type: Number, default: 0 },
    terms: [String]
  }
}, { timestamps: true });

module.exports = {
  Category: mongoose.model('Category', categorySchema),
  Favorite: mongoose.model('Favorite', favoriteSchema),
  Comment: mongoose.model('Comment', commentSchema),
  Message: mongoose.model('Message', messageSchema),
  Conversation: mongoose.model('Conversation', conversationSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  Analytics: mongoose.model('Analytics', analyticsSchema)
};
