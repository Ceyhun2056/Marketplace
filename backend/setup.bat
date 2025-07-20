@echo off
REM Marketplace Backend Setup Script for Windows
REM This script helps set up the backend development environment

setlocal enableextensions

echo.
echo ^🚀 Marketplace Backend Setup
echo ==============================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16 or higher.
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Display Node version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js version: %NODE_VERSION%

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not available. Please reinstall Node.js.
    pause
    exit /b 1
)

echo ✅ npm is available

REM Check if MongoDB is running (optional check)
echo.
echo 🔍 Checking system requirements...
echo ⚠️  Please ensure MongoDB is installed and running:
echo    - Download from: https://www.mongodb.com/try/download/community
echo    - Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest

REM Check if Redis is available (optional)
echo.
echo ℹ️  Redis is optional for caching:
echo    - Download from: https://redis.io/download
echo    - Or use Docker: docker run -d -p 6379:6379 --name redis redis:latest

REM Install dependencies
echo.
echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Create .env file if it doesn't exist
if not exist .env (
    echo.
    echo 📝 Creating .env file...
    copy .env.example .env >nul
    echo ✅ .env file created. Please update it with your configuration.
) else (
    echo ✅ .env file already exists
)

REM Seed database option
echo.
set /p SEED_DB="🌱 Would you like to seed the database with sample data? (y/n): "
if /i "%SEED_DB%"=="y" (
    echo.
    echo 🌱 Seeding database...
    call npm run seed
    if %errorlevel% equ 0 (
        echo ✅ Database seeded successfully!
        echo.
        echo 🔑 Admin credentials:
        echo    Email: admin@marketplace.com
        echo    Password: admin123
    ) else (
        echo ⚠️  Database seeding failed. Make sure MongoDB is running.
    )
)

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo    1. Update .env file with your configuration
echo    2. Start the development server: npm run dev
echo    3. Visit API documentation: http://localhost:5000/api-docs
echo.
echo 🔧 Available commands:
echo    npm run dev      - Start development server
echo    npm start        - Start production server
echo    npm test         - Run tests
echo    npm run seed     - Seed database
echo.
echo Happy coding! 🚀
echo.
pause
