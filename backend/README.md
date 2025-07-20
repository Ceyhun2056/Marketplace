# Marketplace Backend API

A comprehensive, production-ready backend API for a modern marketplace application with real-time features, built with Node.js, Express, and MongoDB.

## 🚀 Features

### Core Features
- **User Authentication & Authorization** - JWT-based auth with role-based access control
- **Product Management** - CRUD operations with image uploads and status management
- **Category System** - Hierarchical categories with statistics
- **Real-time Chat** - WebSocket-based messaging between users
- **Favorites System** - User wishlist functionality
- **Comment & Rating System** - Product reviews and ratings
- **Notification System** - In-app and email notifications
- **Advanced Search** - Full-text search with filters and pagination

### Technical Features
- **Real-time Events** - Socket.IO integration for live updates
- **File Upload** - Cloudinary integration with fallback to base64
- **Caching** - Redis caching with memory fallback
- **Email Service** - Nodemailer integration for transactional emails
- **Input Validation** - Comprehensive validation with express-validator
- **Security** - Helmet, rate limiting, XSS protection, NoSQL injection prevention
- **API Documentation** - Swagger/OpenAPI documentation
- **Scheduled Tasks** - Automated maintenance and cleanup jobs
- **Comprehensive Logging** - Winston-based logging system
- **Database Seeding** - Development data seeding scripts
- **Testing Suite** - Jest-based API testing

### Admin Features
- **Admin Dashboard** - System statistics and analytics
- **User Management** - User moderation and management
- **Product Moderation** - Approve/reject product listings
- **Comment Moderation** - Manage user comments and reviews
- **System Operations** - Database maintenance and system controls
- **Analytics & Reports** - Detailed analytics and reporting

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   ├── errorHandler.js      # Global error handling
│   └── validate.js          # Validation middleware
├── models/
│   ├── User.js              # User model
│   ├── Product.js           # Product model
│   ├── Category.js          # Category model
│   ├── Comment.js           # Comment model
│   ├── Notification.js      # Notification model
│   ├── Message.js           # Chat message model
│   └── Conversation.js      # Chat conversation model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── products.js          # Product CRUD routes
│   ├── categories.js        # Category management routes
│   ├── favorites.js         # Favorites system routes
│   ├── comments.js          # Comment system routes
│   ├── chat.js              # Real-time chat routes
│   ├── notifications.js     # Notification routes
│   ├── analytics.js         # Analytics routes
│   └── admin.js             # Admin panel routes
├── socket/
│   └── socketHandler.js     # Socket.IO event handlers
├── utils/
│   ├── asyncHandler.js      # Async error wrapper
│   ├── responseHandler.js   # Standard API responses
│   ├── logger.js            # Winston logger configuration
│   ├── cache.js             # Redis caching utilities
│   ├── emailService.js      # Email service integration
│   ├── fileUpload.js        # File upload utilities
│   └── scheduledTasks.js    # Cron job definitions
├── validators/
│   └── index.js             # Validation schemas
├── tests/
│   └── api.test.js          # API test suite
├── .env.example             # Environment variables template
├── .env                     # Environment variables (created)
├── server.js                # Main application entry point
├── seeder.js                # Database seeding script
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

## 🛠️ Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Redis (optional, for caching)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd marketplace/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/marketplace
   JWT_SECRET=your-super-secret-jwt-key
   
   # Optional services
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   
   REDIS_URL=redis://localhost:6379
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo systemctl start mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Start Redis (optional)**
   ```bash
   # Using Redis service
   sudo systemctl start redis
   
   # Or using Docker
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

6. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

7. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Documentation

Once the server is running, visit `http://localhost:5000/api-docs` for the interactive Swagger documentation.

### Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Main API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

#### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/avatar` - Upload user avatar

#### Products
- `GET /api/products` - Get products (with filters)
- `POST /api/products` - Create new product
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

#### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (admin)
- `PUT /api/categories/:id` - Update category (admin)
- `DELETE /api/categories/:id` - Delete category (admin)

#### Favorites
- `GET /api/favorites` - Get user favorites
- `POST /api/favorites/:productId` - Add to favorites
- `DELETE /api/favorites/:productId` - Remove from favorites

#### Comments
- `GET /api/comments/product/:productId` - Get product comments
- `POST /api/comments` - Create comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

#### Chat
- `GET /api/chat/conversations` - Get user conversations
- `POST /api/chat/conversations` - Start new conversation
- `GET /api/chat/conversations/:id/messages` - Get conversation messages
- `POST /api/chat/messages` - Send message

#### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read
- `DELETE /api/notifications/:id` - Delete notification

#### Analytics (Admin)
- `GET /api/analytics/dashboard` - Get dashboard statistics
- `GET /api/analytics/users` - Get user analytics
- `GET /api/analytics/products` - Get product analytics

#### Admin
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - Manage users
- `GET /api/admin/products/pending` - Products pending approval
- `PUT /api/admin/products/:id/approve` - Approve product
- `PUT /api/admin/products/:id/reject` - Reject product

## 🧪 Testing

Run the test suite:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## 📊 Database Management

### Seeding Data
```bash
# Seed all data (users, categories, products)
npm run seed

# Seed specific data types
npm run seed:categories
npm run seed:users
npm run seed:products

# Clear all data
npm run seed:clear
```

### Default Admin Account
After seeding, you can use these credentials:
- **Email:** admin@marketplace.com
- **Password:** admin123

## 🔧 Development Tools

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run seed` - Seed database with sample data

### Code Quality
- **ESLint** - Code linting and formatting
- **Jest** - Unit and integration testing
- **Supertest** - API endpoint testing

## 🚀 Deployment

### Environment Variables
Set the following environment variables in production:
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-super-secure-jwt-secret
REDIS_URL=your-redis-url
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
EMAIL_USER=your-production-email
EMAIL_PASS=your-production-email-password
FRONTEND_URL=https://your-frontend-domain.com
```

### Production Considerations
- Use a production-grade MongoDB instance (MongoDB Atlas recommended)
- Set up Redis for caching
- Configure Cloudinary for image hosting
- Set up email service (Gmail, SendGrid, etc.)
- Use a process manager like PM2
- Set up monitoring and logging
- Configure SSL/HTTPS
- Set up automated backups

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🔐 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Role-based Access Control** - Admin and user role separation
- **Rate Limiting** - Prevents abuse and DoS attacks
- **Input Validation** - Comprehensive request validation
- **XSS Protection** - Cross-site scripting prevention
- **NoSQL Injection Prevention** - MongoDB injection protection
- **CORS Configuration** - Cross-origin request handling
- **Helmet Security Headers** - HTTP security headers
- **Password Hashing** - bcrypt password encryption

## 📈 Performance Features

- **Redis Caching** - Fast data retrieval
- **Database Indexing** - Optimized query performance
- **Pagination** - Efficient large dataset handling
- **Image Optimization** - Cloudinary image processing
- **Compression** - Response compression
- **Memory Usage Optimization** - Efficient memory management

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the API documentation at `/api-docs`
- Review the test files for usage examples

## 🗺️ Roadmap

- [ ] Payment integration (Stripe/PayPal)
- [ ] Advanced search with Elasticsearch
- [ ] Mobile push notifications
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Machine learning recommendations
- [ ] Blockchain integration for transactions
- [ ] GraphQL API support
