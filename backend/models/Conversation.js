const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  }],
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: [true, 'Conversation must be about a product']
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
    default: new Map()
  },
  metadata: {
    title: String,
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    },
    tags: [String]
  },
  archivedBy: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  blockedBy: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    blockedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total messages count
conversationSchema.virtual('messagesCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversation',
  count: true,
  match: { isDeleted: false }
});

// Virtual for total unread messages
conversationSchema.virtual('totalUnread').get(function() {
  let total = 0;
  if (this.unreadCount) {
    for (let count of this.unreadCount.values()) {
      total += count;
    }
  }
  return total;
});

// Virtual to check if conversation is between two users
conversationSchema.virtual('isDirectMessage').get(function() {
  return this.participants.length === 2;
});

// Indexes for efficient querying
conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ product: 1 });
conversationSchema.index({ isActive: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, product: 1 }, { unique: true });

// Validation to ensure exactly 2 participants
conversationSchema.pre('validate', function(next) {
  if (this.participants.length !== 2) {
    next(new Error('Conversation must have exactly 2 participants'));
  } else {
    next();
  }
});

// Pre-save middleware to initialize unread counts
conversationSchema.pre('save', function(next) {
  if (this.isNew) {
    // Initialize unread count for each participant
    const unreadCount = new Map();
    this.participants.forEach(participantId => {
      unreadCount.set(participantId.toString(), 0);
    });
    this.unreadCount = unreadCount;
  }
  next();
});

// Instance method to get unread count for a specific user
conversationSchema.methods.getUnreadCount = function(userId) {
  return this.unreadCount?.get(userId.toString()) || 0;
};

// Instance method to set unread count for a specific user
conversationSchema.methods.setUnreadCount = function(userId, count) {
  if (!this.unreadCount) {
    this.unreadCount = new Map();
  }
  this.unreadCount.set(userId.toString(), count);
  return this.save();
};

// Instance method to increment unread count for a specific user
conversationSchema.methods.incrementUnreadCount = function(userId) {
  const currentCount = this.getUnreadCount(userId);
  return this.setUnreadCount(userId, currentCount + 1);
};

// Instance method to reset unread count for a specific user
conversationSchema.methods.resetUnreadCount = function(userId) {
  return this.setUnreadCount(userId, 0);
};

// Instance method to get the other participant
conversationSchema.methods.getOtherParticipant = function(currentUserId) {
  return this.participants.find(p => p._id.toString() !== currentUserId.toString());
};

// Instance method to check if user is participant
conversationSchema.methods.hasParticipant = function(userId) {
  return this.participants.some(p => p._id.toString() === userId.toString());
};

// Instance method to archive conversation for a user
conversationSchema.methods.archiveForUser = function(userId) {
  if (!this.archivedBy.some(a => a.user.toString() === userId.toString())) {
    this.archivedBy.push({
      user: userId,
      archivedAt: new Date()
    });
  }
  return this.save();
};

// Instance method to unarchive conversation for a user
conversationSchema.methods.unarchiveForUser = function(userId) {
  this.archivedBy = this.archivedBy.filter(a => a.user.toString() !== userId.toString());
  return this.save();
};

// Instance method to check if conversation is archived for user
conversationSchema.methods.isArchivedForUser = function(userId) {
  return this.archivedBy.some(a => a.user.toString() === userId.toString());
};

// Instance method to block conversation for a user
conversationSchema.methods.blockForUser = function(userId) {
  if (!this.blockedBy.some(b => b.user.toString() === userId.toString())) {
    this.blockedBy.push({
      user: userId,
      blockedAt: new Date()
    });
  }
  return this.save();
};

// Instance method to unblock conversation for a user
conversationSchema.methods.unblockForUser = function(userId) {
  this.blockedBy = this.blockedBy.filter(b => b.user.toString() !== userId.toString());
  return this.save();
};

// Instance method to check if conversation is blocked for user
conversationSchema.methods.isBlockedForUser = function(userId) {
  return this.blockedBy.some(b => b.user.toString() === userId.toString());
};

// Static method to find or create conversation
conversationSchema.statics.findOrCreateConversation = async function(participant1Id, participant2Id, productId) {
  // Try to find existing conversation
  let conversation = await this.findOne({
    participants: { $all: [participant1Id, participant2Id] },
    product: productId
  });

  if (!conversation) {
    // Create new conversation
    conversation = await this.create({
      participants: [participant1Id, participant2Id],
      product: productId
    });
  }

  return conversation;
};

// Static method to get user's conversations with pagination
conversationSchema.statics.getUserConversations = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    includeArchived = false,
    includeBlocked = false
  } = options;

  const query = { participants: userId };
  
  if (!includeArchived) {
    query['archivedBy.user'] = { $ne: userId };
  }
  
  if (!includeBlocked) {
    query['blockedBy.user'] = { $ne: userId };
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('participants', 'username profile.firstName profile.lastName profile.avatar')
    .populate('product', 'title images price status')
    .populate('lastMessage')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to cleanup old conversations
conversationSchema.statics.cleanupOldConversations = async function(daysOld = 365) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  // Find conversations that haven't been updated in the specified time
  const oldConversations = await this.find({
    updatedAt: { $lt: cutoffDate },
    isActive: true
  });

  // Mark them as inactive instead of deleting
  const result = await this.updateMany(
    { _id: { $in: oldConversations.map(c => c._id) } },
    { isActive: false }
  );

  return result.modifiedCount;
};

module.exports = mongoose.model('Conversation', conversationSchema);
