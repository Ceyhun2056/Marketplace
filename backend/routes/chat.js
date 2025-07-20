const express = require('express');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, getPagination } = require('../utils/responseHandler');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { mongoIdValidation, paginationValidation } = require('../validators');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 */
router.get('/conversations', protect, paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [conversations, total] = await Promise.all([
    Conversation.find({ 
      participants: req.user._id,
      isActive: true 
    })
      .populate('participants', 'username profile.firstName profile.lastName profile.avatar')
      .populate('product', 'title images price status')
      .populate('lastMessage')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Conversation.countDocuments({ 
      participants: req.user._id,
      isActive: true 
    })
  ]);

  // Add unread count and other user info for each conversation
  const conversationsWithDetails = conversations.map(conv => {
    const otherUser = conv.participants.find(p => p._id.toString() !== req.user._id.toString());
    const unreadCount = conv.unreadCount?.get(req.user._id.toString()) || 0;
    
    return {
      ...conv._doc,
      otherUser,
      unreadCount,
      isOnline: false // TODO: Implement online status
    };
  });

  const pagination = getPagination(page, limit, total);

  sendSuccess(res, 'Conversations retrieved successfully', {
    conversations: conversationsWithDetails,
    pagination
  });
}));

/**
 * @swagger
 * /api/chat/conversations/{id}/messages:
 *   get:
 *     summary: Get messages in a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       404:
 *         description: Conversation not found
 */
router.get('/conversations/:id/messages', protect, mongoIdValidation, paginationValidation, validate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  // Check if user is part of the conversation
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    participants: req.user._id
  });

  if (!conversation) {
    return sendError(res, 'Conversation not found', 404);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [messages, total] = await Promise.all([
    Message.find({ 
      conversation: req.params.id,
      isDeleted: false 
    })
      .populate('sender', 'username profile.firstName profile.lastName profile.avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Message.countDocuments({ 
      conversation: req.params.id,
      isDeleted: false 
    })
  ]);

  // Mark messages as read
  await Message.updateMany(
    {
      conversation: req.params.id,
      recipient: req.user._id,
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );

  // Update conversation unread count
  const unreadCount = conversation.unreadCount || new Map();
  unreadCount.set(req.user._id.toString(), 0);
  conversation.unreadCount = unreadCount;
  await conversation.save();

  const pagination = getPagination(page, limit, total);

  // Reverse messages to show oldest first
  messages.reverse();

  sendSuccess(res, 'Messages retrieved successfully', {
    conversation,
    messages,
    pagination
  });
}));

/**
 * @swagger
 * /api/chat/conversations/{id}/messages:
 *   post:
 *     summary: Send a message in a conversation
 *     tags: [Chat]
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
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               messageType:
 *                 type: string
 *                 enum: [text, image, file, offer]
 *               offer:
 *                 type: object
 *                 properties:
 *                   price:
 *                     type: number
 *                   expiresAt:
 *                     type: string
 *                     format: date-time
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       404:
 *         description: Conversation not found
 */
router.post('/conversations/:id/messages', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { message, messageType = 'text', offer } = req.body;

  // Check if user is part of the conversation
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    participants: req.user._id
  }).populate('participants', 'username');

  if (!conversation) {
    return sendError(res, 'Conversation not found', 404);
  }

  // Get the recipient (other participant)
  const recipient = conversation.participants.find(p => p._id.toString() !== req.user._id.toString());

  // Create message
  const messageData = {
    conversation: req.params.id,
    sender: req.user._id,
    recipient: recipient._id,
    message,
    messageType
  };

  // Add offer data if message type is offer
  if (messageType === 'offer' && offer) {
    messageData.offer = {
      price: offer.price,
      status: 'pending',
      expiresAt: offer.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours default
    };
  }

  const newMessage = await Message.create(messageData);

  // Populate sender info
  await newMessage.populate('sender', 'username profile.firstName profile.lastName profile.avatar');

  // Update conversation
  conversation.lastMessage = newMessage._id;
  conversation.updatedAt = new Date();

  // Update unread count for recipient
  const unreadCount = conversation.unreadCount || new Map();
  const currentUnread = unreadCount.get(recipient._id.toString()) || 0;
  unreadCount.set(recipient._id.toString(), currentUnread + 1);
  conversation.unreadCount = unreadCount;

  await conversation.save();

  // Create notification for recipient
  await Notification.create({
    recipient: recipient._id,
    sender: req.user._id,
    type: 'message',
    title: 'New Message',
    message: messageType === 'offer' 
      ? `${req.user.username} sent you an offer of $${offer.price}`
      : `${req.user.username}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
    data: {
      conversationId: req.params.id,
      productId: conversation.product
    }
  });

  // Emit socket events for real-time updates
  const io = req.app.get('io');
  
  // Send to recipient
  io.to(`user_${recipient._id}`).emit('newMessage', {
    conversationId: req.params.id,
    message: newMessage,
    sender: {
      id: req.user._id,
      username: req.user.username
    }
  });

  // Send to sender (for multi-device sync)
  io.to(`user_${req.user._id}`).emit('messageSent', {
    conversationId: req.params.id,
    message: newMessage
  });

  logger.info(`Message sent in conversation ${req.params.id} by user ${req.user._id}`);

  sendSuccess(res, 'Message sent successfully', newMessage, 201);
}));

/**
 * @swagger
 * /api/chat/start:
 *   post:
 *     summary: Start a new conversation about a product
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - message
 *             properties:
 *               productId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Conversation started successfully
 *       400:
 *         description: Cannot start conversation with yourself
 *       404:
 *         description: Product not found
 */
router.post('/start', protect, asyncHandler(async (req, res) => {
  const { productId, message } = req.body;

  // Get product and seller info
  const product = await Product.findOne({ 
    _id: productId, 
    status: 'active' 
  }).populate('seller', 'username');

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  // Check if user is trying to message themselves
  if (product.seller._id.toString() === req.user._id.toString()) {
    return sendError(res, 'You cannot start a conversation about your own product', 400);
  }

  // Check if conversation already exists
  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, product.seller._id] },
    product: productId
  });

  if (!conversation) {
    // Create new conversation
    conversation = await Conversation.create({
      participants: [req.user._id, product.seller._id],
      product: productId,
      unreadCount: new Map()
    });
  }

  // Create the first message
  const newMessage = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    recipient: product.seller._id,
    message,
    messageType: 'text'
  });

  // Update conversation
  conversation.lastMessage = newMessage._id;
  conversation.updatedAt = new Date();

  // Update unread count for seller
  const unreadCount = conversation.unreadCount || new Map();
  const currentUnread = unreadCount.get(product.seller._id.toString()) || 0;
  unreadCount.set(product.seller._id.toString(), currentUnread + 1);
  conversation.unreadCount = unreadCount;

  await conversation.save();

  // Populate conversation data
  await conversation.populate([
    { path: 'participants', select: 'username profile.firstName profile.lastName profile.avatar' },
    { path: 'product', select: 'title images price status' },
    { path: 'lastMessage' }
  ]);

  // Populate message sender
  await newMessage.populate('sender', 'username profile.firstName profile.lastName profile.avatar');

  // Create notification for product seller
  await Notification.create({
    recipient: product.seller._id,
    sender: req.user._id,
    type: 'message',
    title: 'New Message About Your Product',
    message: `${req.user.username} is interested in "${product.title}"`,
    data: {
      conversationId: conversation._id,
      productId: productId
    }
  });

  // Emit socket event for real-time updates
  const io = req.app.get('io');
  io.to(`user_${product.seller._id}`).emit('newConversation', {
    conversation,
    message: newMessage
  });

  logger.info(`New conversation started: ${conversation._id} for product ${productId}`);

  sendSuccess(res, 'Conversation started successfully', {
    conversation,
    message: newMessage
  }, 201);
}));

/**
 * @swagger
 * /api/chat/conversations/{id}/archive:
 *   put:
 *     summary: Archive a conversation
 *     tags: [Chat]
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
 *         description: Conversation archived successfully
 *       404:
 *         description: Conversation not found
 */
router.put('/conversations/:id/archive', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOneAndUpdate(
    { _id: req.params.id, participants: req.user._id },
    { isActive: false },
    { new: true }
  );

  if (!conversation) {
    return sendError(res, 'Conversation not found', 404);
  }

  logger.info(`Conversation archived: ${req.params.id} by user ${req.user._id}`);

  sendSuccess(res, 'Conversation archived successfully', conversation);
}));

/**
 * @swagger
 * /api/chat/messages/{id}/offer/{action}:
 *   put:
 *     summary: Accept or reject an offer
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [accept, reject]
 *     responses:
 *       200:
 *         description: Offer action completed successfully
 *       404:
 *         description: Message not found
 *       400:
 *         description: Invalid action or offer expired
 */
router.put('/messages/:id/offer/:action', protect, mongoIdValidation, validate, asyncHandler(async (req, res) => {
  const { action } = req.params;

  if (!['accept', 'reject'].includes(action)) {
    return sendError(res, 'Invalid action', 400);
  }

  const message = await Message.findOne({
    _id: req.params.id,
    recipient: req.user._id,
    messageType: 'offer',
    'offer.status': 'pending'
  }).populate('sender', 'username');

  if (!message) {
    return sendError(res, 'Offer not found or already processed', 404);
  }

  // Check if offer is expired
  if (message.offer.expiresAt && message.offer.expiresAt < new Date()) {
    message.offer.status = 'expired';
    await message.save();
    return sendError(res, 'Offer has expired', 400);
  }

  // Update offer status
  message.offer.status = action === 'accept' ? 'accepted' : 'rejected';
  await message.save();

  // Create response message
  const responseMessage = await Message.create({
    conversation: message.conversation,
    sender: req.user._id,
    recipient: message.sender._id,
    message: `Offer ${action}ed`,
    messageType: 'text'
  });

  // Create notification for offer sender
  await Notification.create({
    recipient: message.sender._id,
    sender: req.user._id,
    type: 'offer',
    title: `Offer ${action.charAt(0).toUpperCase() + action.slice(1)}ed`,
    message: `Your offer of $${message.offer.price} was ${action}ed`,
    data: {
      conversationId: message.conversation
    }
  });

  // Emit socket event
  const io = req.app.get('io');
  io.to(`user_${message.sender._id}`).emit('offerUpdate', {
    messageId: req.params.id,
    status: message.offer.status,
    action
  });

  logger.info(`Offer ${action}ed: message ${req.params.id} by user ${req.user._id}`);

  sendSuccess(res, `Offer ${action}ed successfully`, {
    message,
    responseMessage
  });
}));

/**
 * @swagger
 * /api/chat/stats:
 *   get:
 *     summary: Get chat statistics for user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat statistics retrieved successfully
 */
router.get('/stats', protect, asyncHandler(async (req, res) => {
  const [
    totalConversations,
    activeConversations,
    totalMessages,
    unreadMessages,
    pendingOffers,
    acceptedOffers
  ] = await Promise.all([
    Conversation.countDocuments({ participants: req.user._id }),
    Conversation.countDocuments({ participants: req.user._id, isActive: true }),
    Message.countDocuments({ 
      $or: [{ sender: req.user._id }, { recipient: req.user._id }],
      isDeleted: false 
    }),
    Message.countDocuments({ recipient: req.user._id, isRead: false, isDeleted: false }),
    Message.countDocuments({ 
      recipient: req.user._id, 
      messageType: 'offer', 
      'offer.status': 'pending',
      isDeleted: false 
    }),
    Message.countDocuments({ 
      sender: req.user._id, 
      messageType: 'offer', 
      'offer.status': 'accepted',
      isDeleted: false 
    })
  ]);

  const stats = {
    conversations: {
      total: totalConversations,
      active: activeConversations
    },
    messages: {
      total: totalMessages,
      unread: unreadMessages
    },
    offers: {
      pending: pendingOffers,
      accepted: acceptedOffers
    }
  };

  sendSuccess(res, 'Chat statistics retrieved successfully', stats);
}));

module.exports = router;
