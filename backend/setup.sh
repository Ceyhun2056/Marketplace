#!/bin/bash

# Marketplace Backend Setup Script
# This script helps set up the backend development environment

set -e  # Exit on any error

echo "🚀 Marketplace Backend Setup"
echo "=============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -c 2-)
REQUIRED_VERSION="16.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo "✅ Node.js version: $NODE_VERSION"
else
    echo "❌ Node.js version $NODE_VERSION is too old. Please install version 16 or higher."
    exit 1
fi

# Check if MongoDB is running
echo "🔍 Checking MongoDB connection..."
if command -v mongo &> /dev/null; then
    if mongo --eval "db.runCommand('ping').ok" localhost/test --quiet; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is not running. Please start MongoDB service."
        echo "   - Ubuntu/Debian: sudo systemctl start mongod"
        echo "   - macOS: brew services start mongodb/brew/mongodb-community"
        echo "   - Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest"
    fi
else
    echo "⚠️  MongoDB CLI not found. Make sure MongoDB is installed and running."
fi

# Check if Redis is available (optional)
echo "🔍 Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running (optional for caching)"
        echo "   - Ubuntu/Debian: sudo systemctl start redis"
        echo "   - macOS: brew services start redis"
        echo "   - Docker: docker run -d -p 6379:6379 --name redis redis:latest"
    fi
else
    echo "ℹ️  Redis not found (optional for caching)"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
else
    echo "✅ .env file already exists"
fi

# Seed database option
echo ""
read -p "🌱 Would you like to seed the database with sample data? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    npm run seed
    echo "✅ Database seeded successfully!"
    echo ""
    echo "🔑 Admin credentials:"
    echo "   Email: admin@marketplace.com"
    echo "   Password: admin123"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Update .env file with your configuration"
echo "   2. Start the development server: npm run dev"
echo "   3. Visit API documentation: http://localhost:5000/api-docs"
echo ""
echo "🔧 Available commands:"
echo "   npm run dev      - Start development server"
echo "   npm start        - Start production server"
echo "   npm test         - Run tests"
echo "   npm run seed     - Seed database"
echo ""
echo "Happy coding! 🚀"
