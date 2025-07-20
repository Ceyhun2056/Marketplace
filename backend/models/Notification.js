const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Notification must have a recipient']
  },
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['message', 'favorite', 'comment', 'offer', 'system', 'product_sold', 'product_viewed'],
    required: [true, 'Notification type is required']
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  data: {
    productId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product'
    },
    conversationId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Conversation'
    },
    commentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Comment'
    },
    offerId: mongoose.Schema.ObjectId,
    url: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for time since creation
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return this.createdAt.toLocaleDateString();
});

// Virtual for notification icon based on type
notificationSchema.virtual('icon').get(function() {
  const icons = {
    message: '💬',
    favorite: '❤️',
    comment: '💭',
    offer: '💰',
    system: '🔔',
    product_sold: '✅',
    product_viewed: '👀'
  };
  return icons[this.type] || '🔔';
});

// Indexes for efficient querying
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to set expiration for certain notification types
notificationSchema.pre('save', function(next) {
  // Set expiration for system notifications (30 days)
  if (this.type === 'system' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  // Set expiration for view notifications (7 days)
  if (this.type === 'product_viewed' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Static method to create notification with validation
notificationSchema.statics.createNotification = async function(data) {
  // Validate required fields
  if (!data.recipient || !data.type || !data.title || !data.message) {
    throw new Error('Missing required notification fields');
  }
  
  // Don't send notifications to self (except system notifications)
  if (data.sender && data.recipient.toString() === data.sender.toString() && data.type !== 'system') {
    return null;
  }
  
  return this.create(data);
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function(recipient, notificationIds = null) {
  const query = { recipient, isRead: false };
  
  if (notificationIds) {
    query._id = { $in: notificationIds };
  }
  
  return this.updateMany(query, {
    isRead: true,
    readAt: new Date()
  });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(recipient) {
  return this.countDocuments({ recipient, isRead: false });
};

// Static method to clean up expired notifications
notificationSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return result.deletedCount;
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Instance method to check if notification is expired
notificationSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

module.exports = mongoose.model('Notification', notificationSchema);
