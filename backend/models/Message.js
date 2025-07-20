const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.ObjectId,
    ref: 'Conversation',
    required: [true, 'Message must belong to a conversation']
  },
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Message must have a sender']
  },
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Message must have a recipient']
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [1000, 'Message cannot exceed 1000 characters'],
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'offer', 'system'],
    default: 'text'
  },
  offer: {
    price: {
      type: Number,
      min: [0, 'Offer price must be positive']
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending'
    },
    expiresAt: {
      type: Date
    }
  },
  attachment: {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  editedAt: {
    type: Date
  },
  replyTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for time since creation
messageSchema.virtual('timeAgo').get(function() {
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

// Virtual to check if message is an offer
messageSchema.virtual('isOffer').get(function() {
  return this.messageType === 'offer';
});

// Virtual to check if offer is expired
messageSchema.virtual('isOfferExpired').get(function() {
  return this.offer && this.offer.expiresAt && this.offer.expiresAt < new Date();
});

// Indexes for efficient querying
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRead: 1 });
messageSchema.index({ messageType: 1, 'offer.status': 1 });
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }); // Auto-delete after 1 year

// Pre-save middleware to handle offer expiration
messageSchema.pre('save', function(next) {
  // Auto-expire offers
  if (this.messageType === 'offer' && this.offer && this.offer.expiresAt) {
    if (this.offer.expiresAt < new Date() && this.offer.status === 'pending') {
      this.offer.status = 'expired';
    }
  }
  
  // Set readAt when marking as read
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  
  // Set deletedAt when marking as deleted
  if (this.isModified('isDeleted') && this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }
  
  next();
});

// Instance method to mark as read
messageSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return this;
};

// Instance method to soft delete
messageSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method to get conversation stats
messageSchema.statics.getConversationStats = function(conversationId) {
  return this.aggregate([
    { $match: { conversation: conversationId, isDeleted: false } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        },
        lastMessage: { $max: '$createdAt' }
      }
    }
  ]);
};

// Static method to mark conversation messages as read
messageSchema.statics.markConversationAsRead = function(conversationId, userId) {
  return this.updateMany(
    {
      conversation: conversationId,
      recipient: userId,
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );
};

module.exports = mongoose.model('Message', messageSchema);
