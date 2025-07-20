const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Product = require('./models/Product');
const Category = require('./models/Category');
const logger = require('./utils/logger');

// Sample data
const categories = [
  {
    name: 'Electronics',
    description: 'Electronic devices and gadgets',
    icon: 'electronics',
    active: true
  },
  {
    name: 'Clothing',
    description: 'Fashion and clothing items',
    icon: 'clothing',
    active: true
  },
  {
    name: 'Books',
    description: 'Books and educational materials',
    icon: 'books',
    active: true
  },
  {
    name: 'Home & Garden',
    description: 'Home improvement and gardening items',
    icon: 'home',
    active: true
  },
  {
    name: 'Sports',
    description: 'Sports and fitness equipment',
    icon: 'sports',
    active: true
  },
  {
    name: 'Health & Beauty',
    description: 'Health and beauty products',
    icon: 'health',
    active: true
  },
  {
    name: 'Automotive',
    description: 'Auto parts and accessories',
    icon: 'automotive',
    active: true
  },
  {
    name: 'Toys & Games',
    description: 'Toys and games for all ages',
    icon: 'toys',
    active: true
  }
];

const adminUser = {
  name: 'Admin User',
  email: 'admin@marketplace.com',
  password: 'admin123',
  role: 'admin',
  status: 'active',
  emailVerified: true,
  profile: {
    bio: 'System Administrator',
    phone: '+1234567890',
    location: 'System'
  }
};

const sampleUsers = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    role: 'user',
    status: 'active',
    emailVerified: true,
    profile: {
      bio: 'Tech enthusiast and seller',
      phone: '+1234567891',
      location: 'New York, NY'
    }
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123',
    role: 'user',
    status: 'active',
    emailVerified: true,
    profile: {
      bio: 'Fashion lover and collector',
      phone: '+1234567892',
      location: 'Los Angeles, CA'
    }
  },
  {
    name: 'Mike Johnson',
    email: 'mike@example.com',
    password: 'password123',
    role: 'user',
    status: 'active',
    emailVerified: true,
    profile: {
      bio: 'Book collector and reader',
      phone: '+1234567893',
      location: 'Chicago, IL'
    }
  }
];

const sampleProducts = [
  {
    title: 'iPhone 13 Pro',
    description: 'Latest iPhone with advanced camera system and A15 Bionic chip. Excellent condition, barely used.',
    price: 899.99,
    category: 'Electronics',
    condition: 'like-new',
    status: 'approved',
    images: ['https://via.placeholder.com/400x400?text=iPhone+13+Pro'],
    tags: ['smartphone', 'apple', 'ios', 'mobile'],
    location: 'New York, NY',
    specifications: {
      brand: 'Apple',
      model: 'iPhone 13 Pro',
      storage: '256GB',
      color: 'Pacific Blue'
    }
  },
  {
    title: 'MacBook Pro 2021',
    description: 'Professional laptop with M1 Pro chip. Perfect for developers and creative professionals.',
    price: 1999.99,
    category: 'Electronics',
    condition: 'excellent',
    status: 'approved',
    images: ['https://via.placeholder.com/400x400?text=MacBook+Pro'],
    tags: ['laptop', 'apple', 'macbook', 'professional'],
    location: 'New York, NY',
    specifications: {
      brand: 'Apple',
      model: 'MacBook Pro',
      processor: 'M1 Pro',
      ram: '16GB',
      storage: '512GB SSD'
    }
  },
  {
    title: 'Designer Jacket',
    description: 'High-quality designer jacket in excellent condition. Size M, perfect for winter.',
    price: 299.99,
    category: 'Clothing',
    condition: 'excellent',
    status: 'approved',
    images: ['https://via.placeholder.com/400x400?text=Designer+Jacket'],
    tags: ['jacket', 'designer', 'winter', 'fashion'],
    location: 'Los Angeles, CA',
    specifications: {
      brand: 'Designer Brand',
      size: 'M',
      material: 'Wool blend',
      season: 'Winter'
    }
  },
  {
    title: 'Programming Book Collection',
    description: 'Collection of 10 programming books covering JavaScript, Python, and React.',
    price: 150.00,
    category: 'Books',
    condition: 'good',
    status: 'approved',
    images: ['https://via.placeholder.com/400x400?text=Programming+Books'],
    tags: ['books', 'programming', 'javascript', 'python', 'react'],
    location: 'Chicago, IL',
    specifications: {
      quantity: 10,
      topics: 'Programming',
      level: 'Beginner to Advanced'
    }
  },
  {
    title: 'Wireless Headphones',
    description: 'Premium wireless headphones with noise cancellation. Great sound quality.',
    price: 199.99,
    category: 'Electronics',
    condition: 'like-new',
    status: 'approved',
    images: ['https://via.placeholder.com/400x400?text=Wireless+Headphones'],
    tags: ['headphones', 'wireless', 'audio', 'music'],
    location: 'New York, NY',
    specifications: {
      brand: 'AudioTech',
      type: 'Over-ear',
      connectivity: 'Bluetooth 5.0',
      battery: '30 hours'
    }
  },
  {
    title: 'Running Shoes',
    description: 'Professional running shoes, size 10. Barely used, perfect for marathon training.',
    price: 129.99,
    category: 'Sports',
    condition: 'like-new',
    status: 'approved',
    images: ['https://via.placeholder.com/400x400?text=Running+Shoes'],
    tags: ['shoes', 'running', 'sports', 'fitness'],
    location: 'Los Angeles, CA',
    specifications: {
      brand: 'SportPro',
      size: '10',
      type: 'Running',
      gender: 'Unisex'
    }
  }
];

class DatabaseSeeder {
  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info('Connected to MongoDB for seeding');
    } catch (error) {
      logger.error('Database connection failed:', error);
      process.exit(1);
    }
  }

  async clearDatabase() {
    try {
      await User.deleteMany({});
      await Product.deleteMany({});
      await Category.deleteMany({});
      logger.info('Database cleared');
    } catch (error) {
      logger.error('Error clearing database:', error);
      throw error;
    }
  }

  async seedCategories() {
    try {
      const createdCategories = await Category.insertMany(categories);
      logger.info(`Created ${createdCategories.length} categories`);
      return createdCategories;
    } catch (error) {
      logger.error('Error seeding categories:', error);
      throw error;
    }
  }

  async seedUsers() {
    try {
      // Hash passwords for all users
      const usersWithHashedPasswords = await Promise.all([
        ...sampleUsers,
        adminUser
      ].map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 12)
      })));

      const createdUsers = await User.insertMany(usersWithHashedPasswords);
      logger.info(`Created ${createdUsers.length} users`);
      return createdUsers;
    } catch (error) {
      logger.error('Error seeding users:', error);
      throw error;
    }
  }

  async seedProducts(users, categories) {
    try {
      // Assign random users and categories to products
      const productsWithRefs = sampleProducts.map((product, index) => {
        const user = users[index % users.length];
        const category = categories.find(cat => cat.name === product.category);
        
        return {
          ...product,
          seller: user._id,
          category: category._id,
          views: Math.floor(Math.random() * 100),
          rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 to 5.0
          reviewCount: Math.floor(Math.random() * 20)
        };
      });

      const createdProducts = await Product.insertMany(productsWithRefs);
      logger.info(`Created ${createdProducts.length} products`);
      return createdProducts;
    } catch (error) {
      logger.error('Error seeding products:', error);
      throw error;
    }
  }

  async seedAll() {
    try {
      await this.connectDB();
      
      logger.info('Starting database seeding...');
      
      // Clear existing data
      await this.clearDatabase();
      
      // Seed data in order
      const categories = await this.seedCategories();
      const users = await this.seedUsers();
      const products = await this.seedProducts(users, categories);
      
      logger.info('Database seeding completed successfully!');
      logger.info(`Summary:`);
      logger.info(`- Categories: ${categories.length}`);
      logger.info(`- Users: ${users.length}`);
      logger.info(`- Products: ${products.length}`);
      
      // Display admin credentials
      logger.info('\nAdmin credentials:');
      logger.info('Email: admin@marketplace.com');
      logger.info('Password: admin123');
      
    } catch (error) {
      logger.error('Database seeding failed:', error);
      process.exit(1);
    } finally {
      await mongoose.connection.close();
      logger.info('Database connection closed');
      process.exit(0);
    }
  }

  async seedSpecific(type) {
    try {
      await this.connectDB();
      
      switch (type) {
        case 'categories':
          await this.seedCategories();
          break;
        case 'users':
          await this.seedUsers();
          break;
        case 'products':
          const existingUsers = await User.find({});
          const existingCategories = await Category.find({});
          await this.seedProducts(existingUsers, existingCategories);
          break;
        default:
          throw new Error(`Unknown seed type: ${type}`);
      }
      
      logger.info(`${type} seeding completed successfully!`);
    } catch (error) {
      logger.error(`${type} seeding failed:`, error);
      process.exit(1);
    } finally {
      await mongoose.connection.close();
      process.exit(0);
    }
  }
}

// CLI usage
const seeder = new DatabaseSeeder();

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'seed':
      seeder.seedAll();
      break;
    case 'seed:categories':
      seeder.seedSpecific('categories');
      break;
    case 'seed:users':
      seeder.seedSpecific('users');
      break;
    case 'seed:products':
      seeder.seedSpecific('products');
      break;
    case 'clear':
      seeder.connectDB().then(() => seeder.clearDatabase()).then(() => {
        logger.info('Database cleared successfully');
        process.exit(0);
      });
      break;
    default:
      console.log('Usage:');
      console.log('  node seeder.js seed           - Seed all data');
      console.log('  node seeder.js seed:categories - Seed only categories');
      console.log('  node seeder.js seed:users     - Seed only users');
      console.log('  node seeder.js seed:products  - Seed only products');
      console.log('  node seeder.js clear          - Clear all data');
      process.exit(1);
  }
}

module.exports = DatabaseSeeder;
