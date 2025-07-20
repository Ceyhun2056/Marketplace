const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Message, Conversation, Notification } = require('../models/index');
const logger = require('../utils/logger');

// Store active users
const activeUsers = new Map();

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

const socketHandler = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    logger.info(`User ${socket.user.name} connected with socket ID: ${socket.id}`);
    
    // Store active user
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Emit user online status to all users
    socket.broadcast.emit('userOnline', {
      userId: socket.userId,
      name: socket.user.name
    });

    // Send current online users to newly connected user
    const onlineUsers = Array.from(activeUsers.values()).map(user => ({
      userId: user.user._id,
      name: user.user.name,
      avatar: user.user.avatar
    }));
    socket.emit('onlineUsers', onlineUsers);

    // Handle joining conversation rooms
    socket.on('joinConversation', async (conversationId) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.participants.includes(socket.userId)) {
          socket.join(`conversation:${conversationId}`);
          logger.info(`User ${socket.userId} joined conversation ${conversationId}`);
        }
      } catch (error) {
        logger.error('Join conversation error:', error);
      }
    });

    // Handle leaving conversation rooms
    socket.on('leaveConversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      logger.info(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // Handle sending messages
    socket.on('sendMessage', async (data) => {
      try {
        const { conversationId, message, messageType = 'text', offer } = data;

        // Verify user is part of conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.userId)) {
          return socket.emit('error', { message: 'Unauthorized to send message to this conversation' });
        }

        // Create new message
        const newMessage = new Message({
          conversation: conversationId,
          sender: socket.userId,
          recipient: conversation.participants.find(p => p.toString() !== socket.userId),
          message,
          messageType,
          offer
        });

        await newMessage.save();
        await newMessage.populate('sender', 'name avatar');

        // Update conversation with last message
        conversation.lastMessage = newMessage._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        // Emit message to conversation room
        io.to(`conversation:${conversationId}`).emit('newMessage', {
          _id: newMessage._id,
          conversation: conversationId,
          sender: newMessage.sender,
          message: newMessage.message,
          messageType: newMessage.messageType,
          offer: newMessage.offer,
          createdAt: newMessage.createdAt
        });

        // Send push notification to recipient if offline
        const recipientId = newMessage.recipient.toString();
        if (!activeUsers.has(recipientId)) {
          // Create notification
          const notification = new Notification({
            recipient: recipientId,
            sender: socket.userId,
            type: 'message',
            title: 'New Message',
            message: `${socket.user.name} sent you a message`,
            data: { conversationId }
          });
          await notification.save();
        }

        logger.info(`Message sent in conversation ${conversationId} by user ${socket.userId}`);
      } catch (error) {
        logger.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message read status
    socket.on('markAsRead', async (data) => {
      try {
        const { messageId, conversationId } = data;
        
        await Message.findByIdAndUpdate(messageId, {
          isRead: true,
          readAt: new Date()
        });

        // Emit read receipt to conversation
        socket.to(`conversation:${conversationId}`).emit('messageRead', {
          messageId,
          readBy: socket.userId,
          readAt: new Date()
        });
      } catch (error) {
        logger.error('Mark as read error:', error);
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      const { conversationId, isTyping } = data;
      socket.to(`conversation:${conversationId}`).emit('userTyping', {
        userId: socket.userId,
        userName: socket.user.name,
        isTyping
      });
    });

    // Handle offer responses
    socket.on('respondToOffer', async (data) => {
      try {
        const { messageId, response } = data; // response: 'accepted' | 'rejected'
        
        const message = await Message.findById(messageId);
        if (message && message.offer && message.recipient.toString() === socket.userId) {
          message.offer.status = response;
          await message.save();

          // Emit offer response to conversation
          io.to(`conversation:${message.conversation}`).emit('offerResponse', {
            messageId,
            response,
            respondedBy: socket.userId
          });

          // Create notification for sender
          const notification = new Notification({
            recipient: message.sender,
            sender: socket.userId,
            type: 'offer',
            title: 'Offer Response',
            message: `Your offer was ${response}`,
            data: { 
              conversationId: message.conversation,
              messageId 
            }
          });
          await notification.save();

          // Send real-time notification
          io.to(`user:${message.sender}`).emit('notification', notification);
        }
      } catch (error) {
        logger.error('Respond to offer error:', error);
      }
    });

    // Handle product view tracking
    socket.on('viewProduct', async (productId) => {
      try {
        const Product = require('../models/Product');
        await Product.findByIdAndUpdate(productId, { $inc: { views: 1 } });
        
        // Emit view count update to all users viewing this product
        socket.broadcast.emit('productViewUpdate', {
          productId,
          viewerId: socket.userId
        });
      } catch (error) {
        logger.error('Product view tracking error:', error);
      }
    });

    // Handle product favorites in real-time
    socket.on('toggleFavorite', async (data) => {
      try {
        const { productId, action } = data; // action: 'add' | 'remove'
        
        // Emit favorite update to product owner
        const Product = require('../models/Product');
        const product = await Product.findById(productId).populate('seller', '_id');
        
        if (product && product.seller._id.toString() !== socket.userId) {
          io.to(`user:${product.seller._id}`).emit('favoriteUpdate', {
            productId,
            userId: socket.userId,
            userName: socket.user.name,
            action
          });

          // Create notification for product owner
          if (action === 'add') {
            const notification = new Notification({
              recipient: product.seller._id,
              sender: socket.userId,
              type: 'favorite',
              title: 'Product Favorited',
              message: `${socket.user.name} favorited your product`,
              data: { productId }
            });
            await notification.save();
            
            io.to(`user:${product.seller._id}`).emit('notification', notification);
          }
        }
      } catch (error) {
        logger.error('Toggle favorite error:', error);
      }
    });

    // Handle new product notifications
    socket.on('newProduct', async (productData) => {
      try {
        // Emit to all users except the creator
        socket.broadcast.emit('newProductAlert', {
          productId: productData._id,
          title: productData.title,
          category: productData.category,
          price: productData.price,
          seller: {
            name: socket.user.name,
            avatar: socket.user.avatar
          }
        });
        
        logger.info(`New product alert sent for product ${productData._id}`);
      } catch (error) {
        logger.error('New product notification error:', error);
      }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      logger.info(`User ${socket.user.name} disconnected`);
      
      // Remove from active users
      activeUsers.delete(socket.userId);
      
      // Emit user offline status
      socket.broadcast.emit('userOffline', {
        userId: socket.userId,
        name: socket.user.name,
        lastSeen: new Date()
      });

      // Update user's last seen in database
      User.findByIdAndUpdate(socket.userId, { 
        lastLogin: new Date() 
      }).catch(err => logger.error('Update last seen error:', err));
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  // Periodic cleanup of inactive connections
  setInterval(() => {
    const now = new Date();
    for (const [userId, userData] of activeUsers.entries()) {
      if (now - userData.lastSeen > 30 * 60 * 1000) { // 30 minutes
        activeUsers.delete(userId);
        logger.info(`Cleaned up inactive user: ${userId}`);
      }
    }
  }, 10 * 60 * 1000); // Run every 10 minutes
};

module.exports = socketHandler;
