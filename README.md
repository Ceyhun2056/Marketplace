# Marketplace App

## Overview
Marketplace is a full-featured web application for buying and selling products, built with a modular Node.js/Express/MongoDB backend and a modern frontend. It supports real-time chat, notifications, admin panel, analytics, secure authentication, and more.

## Features
- User registration, login, profile management
- Product CRUD (create, read, update, delete) with image upload
- Category system and advanced search
- Favorites, comments, ratings
- Real-time chat and notifications (Socket.IO)
- Admin panel for moderation and analytics
- Email notifications (password reset, welcome, etc.)
- Payment integration ready (Stripe/PayPal)
- Secure, validated, and scalable backend

## Project Structure
```
Marketplace/
├── backend/         # Node.js/Express/MongoDB API
│   ├── models/      # Mongoose models
│   ├── routes/      # API route handlers
│   ├── middleware/  # Auth, error, validation
│   ├── utils/       # Helpers (email, cache, upload, etc.)
│   ├── socket/      # Real-time event handlers
│   ├── validators/  # Input validation schemas
│   ├── tests/       # Automated API tests
│   ├── config/      # Database and service configs
│   ├── seeder.js    # Database seeding script
│   ├── server.js    # Main app entry point
│   ├── ...          # Docker, env, docs
├── frontend/        # Client-side app (HTML/CSS/JS)
│   ├── index.html   # Main UI
│   ├── index.js     # App logic
│   ├── style.css    # Styles
│   ├── js/          # API service layer
│   ├── media/       # Images/icons
│   └── ...
├── README.md        # Project documentation
├── LICENSE          # License info
```

## Quick Start
### Backend
1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your config
4. Start MongoDB and Redis (optional)
5. `npm run dev` (development) or `npm start` (production)
6. Visit `http://localhost:5000/api-docs` for API docs

### Frontend
1. Open `frontend/index.html` in your browser
2. Connect frontend API calls to backend endpoints

## API Highlights
- `/api/auth/register` / `/api/auth/login` / `/api/auth/profile`
- `/api/products` / `/api/products/:id` / `/api/products/:id/images`
- `/api/categories` / `/api/search`
- `/api/favorites` / `/api/comments`
- `/api/chat` / `/api/notifications`
- `/api/admin` / `/api/analytics`

## Development & Testing
- Automated tests: `npm test` (backend)
- Seed sample data: `npm run seed`
- Lint code: `npm run lint`

## Deployment
- Docker and docker-compose supported
- Environment variables for production security

## License
MIT