
# Marketplace Application

## 📋 Overview

This marketplace application provides a complete e-commerce experience with user authentication, product listings, shopping cart, multi-language support, and hybrid storage options. Built with vanilla JavaScript, HTML, and CSS, this application works directly in the browser without requiring a backend server.

## ✨ Features

### 🔐 Authentication & User Management
- Local or cloud-based authentication system
- User registration and login system
- User profiles with avatar uploads
- Profile management with personal information editing
- User statistics (listings count, reviews, member since)

### 🛍️ Product Management
- Complete CRUD operations for products
- Product categories with visual tiles
- Image upload and management
- Product search and filtering
- Stock management
- Product variants (size, color, etc.)
- Product reviews and ratings

### 💬 Social Features
- Favorites/wishlist system
- Shopping cart functionality
- Order history tracking
- Comments and reviews on products

### 🌍 Multi-language Support
- Support for 3 languages: Azerbaijani (AZ), English (EN), Russian (RU)
- Dynamic language switching
- Internationalization with `data-i18n` attributes

### 📱 UI/UX Features
- Responsive design for all devices
- Dark mode support
- Category-based product browsing
- Advanced search with filters
- Location-based filtering
- Modal-based interactions

### 💾 Data Storage Options
- Local storage (default): Store data in browser's localStorage
- Cloud storage (optional): Store data in Firebase for cross-device access



## 📱 Frontend Features

### Language Support
- Dynamic language switching between AZ, EN, RU
- All text elements support internationalization
- Persistent language preference

### Product Categories
- Electronics, Books, Clothing, Home & Garden
- Services, Transport, Sports, Personal Items
- Animals, Medical Products

### User Interface
- Responsive design for mobile and desktop
- Dark mode toggle
- Advanced search and filtering
- Modal-based interactions

## 💾 Storage Options

### Local Storage (Default)
- Data is stored in the browser's localStorage
- Works offline and without any additional setup
- Data is limited to the current browser
- Clearing browser data will erase all information

### Cloud Storage (Optional via Firebase)
- Cross-device data synchronization
- User authentication with Firebase Auth
- Data persistence even if browser data is cleared
- Profile and product data stored in Firestore
- Avatar images stored in Firebase Storage



## 📊 Features in Detail

### Authentication System
- Hybrid authentication system (localStorage or Firebase)
- User profile management
- Session persistence across page reloads
- User role management

### Product Management
- Full CRUD operations
- Image upload support
- Product variants (size, color)
- Inventory tracking
- Category organization

### Search & Filtering
- Text-based search
- Category filtering
- Price range filtering
- Location-based filtering
- Sort by date, price, popularity

## 🚀 Setting Up Cloud Storage

To enable cloud storage functionality with Firebase:

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com/)
2. Enable Authentication (email/password) in the Firebase console
3. Set up Firestore Database with appropriate security rules
4. Create a Storage bucket for images
5. Register a web app in your Firebase project
6. Copy your Firebase configuration
7. Edit `config.js` and update the Firebase configuration:

```javascript
// Application Configuration
const appConfig = {
    // Set to true to enable cloud storage, false to use localStorage only
    useCloudStorage: true,
    
    // Firebase configuration
    firebase: {
        apiKey: "YOUR_API_KEY",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "your-sender-id",
        appId: "your-app-id"
    }
};
```

## �‍💻 Running the Application

### Local Development

This application is a static website that can be served with any HTTP server. Here are a few options:

#### Using Python's built-in HTTP server:
```bash
# Navigate to the project directory
cd path/to/marketplace

# Start the server on port 8000
python -m http.server 8000
```

#### Using Node.js with http-server:
```bash
# Install http-server if not already installed
npm install -g http-server

# Navigate to the project directory
cd path/to/marketplace

# Start the server
http-server -p 8000
```

Then open your browser and go to: http://localhost:8000

### Deploying to GitHub Pages

1. Push your repository to GitHub
2. Go to Settings > Pages
3. Select the branch to deploy (usually main or master)
4. Click Save

Your site will be available at `https://your-username.github.io/marketplace/`

## �🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues

- Image uploads are limited to 5MB
- Real-time features require stable internet connection
- Some features require JavaScript enabled

## 🔮 Future Enhancements

- [ ] Payment gateway integration (Stripe/PayPal)
- [ ] Email notifications
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] Shipping integration
- [ ] Multi-vendor support
- [ ] Advanced product filtering
- [ ] Order tracking system



## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by popular marketplace platforms like Avito
- Thanks to all contributors and the open-source community

