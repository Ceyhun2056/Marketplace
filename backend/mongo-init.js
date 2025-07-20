// MongoDB initialization script
// This script runs when MongoDB container starts for the first time

db = db.getSiblingDB('marketplace');

// Create initial user for the marketplace database
db.createUser({
  user: 'marketplace_user',
  pwd: 'marketplace_password',
  roles: [
    {
      role: 'readWrite',
      db: 'marketplace'
    }
  ]
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ status: 1 });
db.users.createIndex({ createdAt: -1 });

db.products.createIndex({ title: 'text', description: 'text', tags: 'text' });
db.products.createIndex({ seller: 1 });
db.products.createIndex({ category: 1 });
db.products.createIndex({ status: 1 });
db.products.createIndex({ price: 1 });
db.products.createIndex({ createdAt: -1 });
db.products.createIndex({ views: -1 });
db.products.createIndex({ rating: -1 });

db.categories.createIndex({ name: 1 }, { unique: true });
db.categories.createIndex({ active: 1 });

db.comments.createIndex({ product: 1 });
db.comments.createIndex({ user: 1 });
db.comments.createIndex({ createdAt: -1 });

db.notifications.createIndex({ user: 1 });
db.notifications.createIndex({ read: 1 });
db.notifications.createIndex({ createdAt: -1 });

db.messages.createIndex({ conversation: 1 });
db.messages.createIndex({ sender: 1 });
db.messages.createIndex({ createdAt: -1 });

db.conversations.createIndex({ participants: 1 });
db.conversations.createIndex({ lastActivity: -1 });

print('✅ Marketplace database initialized with indexes');
