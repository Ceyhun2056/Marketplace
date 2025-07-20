const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');

// Test database
const MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/marketplace_test';

describe('Marketplace API Tests', () => {
  let server;
  let authToken;
  let testUser;
  let testCategory;
  let testProduct;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGODB_URI);
    
    // Start server
    server = app.listen(0);
  });

  afterAll(async () => {
    // Clean up
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clear collections before each test
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
  });

  describe('Authentication', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
        const userData = {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe(userData.email);
        expect(response.body.data.token).toBeDefined();
      });

      it('should not register user with invalid email', async () => {
        const userData = {
          name: 'Test User',
          email: 'invalid-email',
          password: 'password123',
          confirmPassword: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should not register user with mismatched passwords', async () => {
        const userData = {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          confirmPassword: 'different123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/auth/login', () => {
      beforeEach(async () => {
        // Create test user
        testUser = await User.create({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          emailVerified: true
        });
      });

      it('should login user with correct credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
        authToken = response.body.data.token;
      });

      it('should not login user with incorrect password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Categories', () => {
    beforeEach(async () => {
      // Create test user and get auth token
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'admin',
        emailVerified: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      authToken = loginResponse.body.data.token;
    });

    describe('GET /api/categories', () => {
      it('should get all categories', async () => {
        // Create test categories
        await Category.create([
          { name: 'Electronics', description: 'Electronic items' },
          { name: 'Books', description: 'Books and literature' }
        ]);

        const response = await request(app)
          .get('/api/categories')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.categories).toHaveLength(2);
      });
    });

    describe('POST /api/categories', () => {
      it('should create new category (admin only)', async () => {
        const categoryData = {
          name: 'Electronics',
          description: 'Electronic devices and gadgets',
          icon: 'electronics'
        };

        const response = await request(app)
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send(categoryData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.category.name).toBe(categoryData.name);
      });

      it('should not create category without authentication', async () => {
        const categoryData = {
          name: 'Electronics',
          description: 'Electronic devices and gadgets'
        };

        const response = await request(app)
          .post('/api/categories')
          .send(categoryData)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Products', () => {
    beforeEach(async () => {
      // Create test user
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        emailVerified: true
      });

      // Create test category
      testCategory = await Category.create({
        name: 'Electronics',
        description: 'Electronic items'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      authToken = loginResponse.body.data.token;
    });

    describe('GET /api/products', () => {
      it('should get all approved products', async () => {
        // Create test products
        await Product.create([
          {
            title: 'iPhone 13',
            description: 'Latest iPhone',
            price: 999,
            category: testCategory._id,
            seller: testUser._id,
            status: 'approved'
          },
          {
            title: 'Samsung Galaxy',
            description: 'Android phone',
            price: 799,
            category: testCategory._id,
            seller: testUser._id,
            status: 'pending'
          }
        ]);

        const response = await request(app)
          .get('/api/products')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.products).toHaveLength(1); // Only approved products
      });

      it('should filter products by category', async () => {
        const category2 = await Category.create({
          name: 'Books',
          description: 'Books and literature'
        });

        await Product.create([
          {
            title: 'iPhone 13',
            description: 'Latest iPhone',
            price: 999,
            category: testCategory._id,
            seller: testUser._id,
            status: 'approved'
          },
          {
            title: 'Programming Book',
            description: 'Learn programming',
            price: 29,
            category: category2._id,
            seller: testUser._id,
            status: 'approved'
          }
        ]);

        const response = await request(app)
          .get(`/api/products?category=${testCategory._id}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.products).toHaveLength(1);
        expect(response.body.data.products[0].title).toBe('iPhone 13');
      });
    });

    describe('POST /api/products', () => {
      it('should create new product', async () => {
        const productData = {
          title: 'Test Product',
          description: 'A test product',
          price: 99.99,
          category: testCategory._id,
          condition: 'new',
          location: 'Test City'
        };

        const response = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${authToken}`)
          .send(productData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.product.title).toBe(productData.title);
        expect(response.body.data.product.status).toBe('pending');
      });

      it('should not create product without authentication', async () => {
        const productData = {
          title: 'Test Product',
          description: 'A test product',
          price: 99.99,
          category: testCategory._id
        };

        const response = await request(app)
          .post('/api/products')
          .send(productData)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('User Profile', () => {
    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        emailVerified: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      authToken = loginResponse.body.data.token;
    });

    describe('GET /api/users/profile', () => {
      it('should get user profile', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe('test@example.com');
      });

      it('should not get profile without authentication', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/users/profile', () => {
      it('should update user profile', async () => {
        const updateData = {
          name: 'Updated Name',
          profile: {
            bio: 'Updated bio',
            location: 'New Location'
          }
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.name).toBe(updateData.name);
      });
    });
  });
});
