// tests/routes/auth.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Authentication Routes Tests', () => {
  let app;
  let mongoServer;
  let testConnection;
  let UserCollection;

  beforeAll(async () => {
    // Create in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    testConnection = mongoose.createConnection(mongoUri);

    // Create User schema for testing
    const UserSchema = new mongoose.Schema({
      name: { type: String, required: true },
      password: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      phone: String,
      role: { 
        type: String, 
        enum: ['admin', 'vet', 'staff', 'user'], 
        default: 'user' 
      },
      createdAt: { type: Date, default: Date.now }
    });

    UserCollection = testConnection.model('users', UserSchema);

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Setup session
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }
    }));

    app.set('view engine', 'ejs');

    // Mock login route
    app.post('/login', async (req, res) => {
      try {
        const { username, password } = req.body;

        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await UserCollection.findOne({
          $or: [
            { name: username },
            { email: username }
          ]
        });
        
        if (!user) {
          return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }

        // Simple password check (in real app, use bcrypt)
        if (password !== user.password) {
          return res.status(401).json({ error: 'Mật khẩu không đúng' });
        }

        // Set session
        req.session.name = user.name;
        req.session.role = user.role;
        req.session.userId = user._id;

        res.json({ 
          success: true, 
          user: {
            id: user._id,
            name: user.name,
            role: user.role,
            email: user.email
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi đăng nhập' });
      }
    });

    // Mock signup route
    app.post('/signup', async (req, res) => {
      try {
        const { fullName, email, password, confirmPassword, phone } = req.body;
        
        if (!fullName || !email || !password) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        if (password !== confirmPassword) {
          return res.status(400).json({ error: 'Mật khẩu không khớp' });
        }
        
        // Check if email already exists
        const existingUser = await UserCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ error: 'Email đã được sử dụng' });
        }
        
        // Create new user
        const newUser = await UserCollection.create({
          name: fullName,
          password: password,
          email: email,
          phone: phone,
          role: 'user'
        });
        
        // Set session
        req.session.userId = newUser._id;
        req.session.name = newUser.name;
        req.session.role = 'user';
        
        res.status(201).json({ 
          success: true,
          user: {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi đăng ký' });
      }
    });

    // Mock logout route
    app.post('/logout', (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: 'Lỗi đăng xuất' });
        }
        res.json({ success: true, message: 'Đăng xuất thành công' });
      });
    });

    // Protected route for testing authentication
    app.get('/protected', (req, res) => {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      res.json({ 
        message: 'Access granted',
        user: {
          id: req.session.userId,
          name: req.session.name,
          role: req.session.role
        }
      });
    });

    // Admin-only route for testing authorization
    app.get('/admin-only', (req, res) => {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      res.json({ message: 'Admin access granted' });
    });

    // Vet-only route for testing authorization
    app.get('/vet-only', (req, res) => {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      res.json({ message: 'Vet access granted' });
    });
  });

  afterAll(async () => {
    if (testConnection && testConnection.readyState === 1) {
      await testConnection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Ensure connection is still open before cleaning
    if (testConnection.readyState !== 1) {
      // Reconnect if connection was closed
      const mongoUri = mongoServer.getUri();
      testConnection = mongoose.createConnection(mongoUri);
      
      // Recreate the UserCollection model
      const UserSchema = new mongoose.Schema({
        name: { type: String, required: true },
        password: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phone: String,
        role: { 
          type: String, 
          enum: ['admin', 'vet', 'staff', 'user'], 
          default: 'user' 
        },
        createdAt: { type: Date, default: Date.now }
      });
      
      UserCollection = testConnection.model('users', UserSchema);
    }
    
    // Clean database before each test
    try {
      await UserCollection.deleteMany({});
    } catch (error) {
      console.warn('Failed to clean database:', error.message);
      // If cleanup fails, continue with test
    }
  });

  // TEST 1: User Signup
  describe('POST /signup', () => {
    test('should create new user successfully', async () => {
      const userData = {
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        phone: '0123456789'
      };

      const response = await request(app)
        .post('/signup')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe('John Doe');
      expect(response.body.user.email).toBe('john@example.com');
      expect(response.body.user.role).toBe('user');

      // Verify user was created in database
      const user = await UserCollection.findOne({ email: 'john@example.com' });
      expect(user).toBeTruthy();
      expect(user.name).toBe('John Doe');
    });

    test('should reject signup with missing required fields', async () => {
      const incompleteData = {
        fullName: 'Incomplete User',
        email: 'incomplete@example.com'
        // Missing password
      };

      const response = await request(app)
        .post('/signup')
        .send(incompleteData)
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });

    test('should reject signup with mismatched passwords', async () => {
      const userData = {
        fullName: 'Mismatch User',
        email: 'mismatch@example.com',
        password: 'password123',
        confirmPassword: 'different456',
        phone: '0123456789'
      };

      const response = await request(app)
        .post('/signup')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Mật khẩu không khớp');
    });

    test('should reject signup with existing email', async () => {
      // Create existing user
      await UserCollection.create({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'password123',
        role: 'user'
      });

      const userData = {
        fullName: 'New User',
        email: 'existing@example.com',
        password: 'newpassword',
        confirmPassword: 'newpassword'
      };

      const response = await request(app)
        .post('/signup')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('Email đã được sử dụng');
    });
  });

  // TEST 2: User Login
  describe('POST /login', () => {
    beforeEach(async () => {
      // Create test users
      await UserCollection.create([
        {
          name: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          role: 'user'
        },
        {
          name: 'admin',
          email: 'admin@example.com',
          password: 'admin123',
          role: 'admin'
        },
        {
          name: 'vet',
          email: 'vet@example.com',
          password: 'vet123',
          role: 'vet'
        }
      ]);
    });

    test('should login with valid username and password', async () => {
      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe('testuser');
      expect(response.body.user.role).toBe('user');
    });

    test('should login with valid email and password', async () => {
      const loginData = {
        username: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
    });

    test('should reject login with invalid username', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Tài khoản không tồn tại');
    });

    test('should reject login with invalid password', async () => {
      const loginData = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Mật khẩu không đúng');
    });

    test('should reject login with missing credentials', async () => {
      const loginData = {
        username: 'testuser'
        // Missing password
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(400);

      expect(response.body.error).toBe('Username and password required');
    });

    test('should login admin user with correct role', async () => {
      const loginData = {
        username: 'admin',
        password: 'admin123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.role).toBe('admin');
    });

    test('should login vet user with correct role', async () => {
      const loginData = {
        username: 'vet',
        password: 'vet123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.role).toBe('vet');
    });
  });

  // TEST 3: Logout
  describe('POST /logout', () => {
    test('should logout user successfully', async () => {
      // First login
      await UserCollection.create({
        name: 'logouttest',
        email: 'logout@example.com',
        password: 'password123',
        role: 'user'
      });

      const agent = request.agent(app);
      
      await agent
        .post('/login')
        .send({
          username: 'logouttest',
          password: 'password123'
        })
        .expect(200);

      // Then logout
      const response = await agent
        .post('/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Đăng xuất thành công');

      // Verify session is destroyed by trying to access protected route
      await agent
        .get('/protected')
        .expect(401);
    });
  });

  // TEST 4: Authentication Middleware
  describe('Authentication Middleware', () => {
    test('should allow access to protected route when authenticated', async () => {
      await UserCollection.create({
        name: 'authtest',
        email: 'auth@example.com',
        password: 'password123',
        role: 'user'
      });

      const agent = request.agent(app);
      
      // Login first
      await agent
        .post('/login')
        .send({
          username: 'authtest',
          password: 'password123'
        })
        .expect(200);

      // Access protected route
      const response = await agent
        .get('/protected')
        .expect(200);

      expect(response.body.message).toBe('Access granted');
      expect(response.body.user.name).toBe('authtest');
    });

    test('should deny access to protected route when not authenticated', async () => {
      const response = await request(app)
        .get('/protected')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  // TEST 5: Authorization (Role-based Access)
  describe('Authorization Tests', () => {
    test('should allow admin access to admin-only route', async () => {
      await UserCollection.create({
        name: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      });

      const agent = request.agent(app);
      
      await agent
        .post('/login')
        .send({
          username: 'admin',
          password: 'admin123'
        })
        .expect(200);

      const response = await agent
        .get('/admin-only')
        .expect(200);

      expect(response.body.message).toBe('Admin access granted');
    });

    test('should deny non-admin access to admin-only route', async () => {
      await UserCollection.create({
        name: 'regularuser',
        email: 'regular@example.com',
        password: 'password123',
        role: 'user'
      });

      const agent = request.agent(app);
      
      await agent
        .post('/login')
        .send({
          username: 'regularuser',
          password: 'password123'
        })
        .expect(200);

      const response = await agent
        .get('/admin-only')
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
    });

    test('should allow vet access to vet-only route', async () => {
      await UserCollection.create({
        name: 'vet',
        email: 'vet@example.com',
        password: 'vet123',
        role: 'vet'
      });

      const agent = request.agent(app);
      
      await agent
        .post('/login')
        .send({
          username: 'vet',
          password: 'vet123'
        })
        .expect(200);

      const response = await agent
        .get('/vet-only')
        .expect(200);

      expect(response.body.message).toBe('Vet access granted');
    });

    test('should allow admin access to vet-only route', async () => {
      await UserCollection.create({
        name: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      });

      const agent = request.agent(app);
      
      await agent
        .post('/login')
        .send({
          username: 'admin',
          password: 'admin123'
        })
        .expect(200);

      const response = await agent
        .get('/vet-only')
        .expect(200);

      expect(response.body.message).toBe('Vet access granted');
    });

    test('should deny regular user access to vet-only route', async () => {
      await UserCollection.create({
        name: 'regularuser',
        email: 'regular@example.com',
        password: 'password123',
        role: 'user'
      });

      const agent = request.agent(app);
      
      await agent
        .post('/login')
        .send({
          username: 'regularuser',
          password: 'password123'
        })
        .expect(200);

      const response = await agent
        .get('/vet-only')
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
    });
  });

  // TEST 6: Session Management
  describe('Session Management', () => {
    test('should maintain session across multiple requests', async () => {
      await UserCollection.create({
        name: 'sessiontest',
        email: 'session@example.com',
        password: 'password123',
        role: 'user'
      });

      const agent = request.agent(app);
      
      // Login
      await agent
        .post('/login')
        .send({
          username: 'sessiontest',
          password: 'password123'
        })
        .expect(200);

      // Multiple requests should maintain session
      await agent.get('/protected').expect(200);
      await agent.get('/protected').expect(200);
      await agent.get('/protected').expect(200);

      // All should return the same user info
      const response = await agent.get('/protected').expect(200);
      expect(response.body.user.name).toBe('sessiontest');
    });

    test('should handle concurrent login attempts', async () => {
      await UserCollection.create({
        name: 'concurrent',
        email: 'concurrent@example.com',
        password: 'password123',
        role: 'user'
      });

      const loginData = {
        username: 'concurrent',
        password: 'password123'
      };

      // Multiple concurrent login requests
      const promises = Array(5).fill().map(() => 
        request(app)
          .post('/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  // TEST 7: Security Tests
  describe('Security Tests', () => {
    test('should not expose sensitive user information', async () => {
      await UserCollection.create({
        name: 'securitytest',
        email: 'security@example.com',
        password: 'secretpassword',
        role: 'user'
      });

      const response = await request(app)
        .post('/login')
        .send({
          username: 'securitytest',
          password: 'secretpassword'
        })
        .expect(200);

      // Password should not be returned
      expect(response.body.user.password).toBeUndefined();
      
      // Only safe user info should be returned
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('role');
      expect(response.body.user).not.toHaveProperty('password');
    });

    test('should handle SQL injection attempts in login', async () => {
      await UserCollection.create({
        name: 'victim',
        email: 'victim@example.com',
        password: 'password123',
        role: 'user'
      });

      // SQL injection attempt
      const maliciousData = {
        username: "victim'; DROP TABLE users; --",
        password: 'anything'
      };

      const response = await request(app)
        .post('/login')
        .send(maliciousData)
        .expect(401);

      expect(response.body.error).toBe('Tài khoản không tồn tại');

      // Verify user still exists
      const user = await UserCollection.findOne({ name: 'victim' });
      expect(user).toBeTruthy();
    });

    test('should handle NoSQL injection attempts', async () => {
      await UserCollection.create({
        name: 'target',
        email: 'target@example.com',
        password: 'password123',
        role: 'admin'
      });

      // NoSQL injection attempt
      const maliciousData = {
        username: { $ne: null },
        password: { $ne: null }
      };

      const response = await request(app)
        .post('/login')
        .send(maliciousData)
        .expect(500); // Should fail due to invalid query

      expect(response.body.error).toBe('Lỗi đăng nhập');
    });

    test('should prevent user enumeration through timing attacks', async () => {
      await UserCollection.create({
        name: 'realuser',
        email: 'real@example.com',
        password: 'password123',
        role: 'user'
      });

      // Test login with existing user
      const start1 = Date.now();
      await request(app)
        .post('/login')
        .send({
          username: 'realuser',
          password: 'wrongpassword'
        })
        .expect(401);
      const duration1 = Date.now() - start1;

      // Test login with non-existing user
      const start2 = Date.now();
      await request(app)
        .post('/login')
        .send({
          username: 'fakeuser',
          password: 'wrongpassword'
        })
        .expect(401);
      const duration2 = Date.now() - start2;

      // Time difference should be minimal (within reasonable bounds)
      const timeDifference = Math.abs(duration1 - duration2);
      expect(timeDifference).toBeLessThan(100); // Within 100ms
    });
  });

  // TEST 8: Error Handling
  describe('Error Handling', () => {
    test('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/login')
        .send('invalid json')
        .expect(400);

      // Should handle the error gracefully
    });

    test('should handle very long input values', async () => {
      const longString = 'a'.repeat(10000);
      
      const response = await request(app)
        .post('/login')
        .send({
          username: longString,
          password: longString
        })
        .expect(401);

      expect(response.body.error).toBe('Tài khoản không tồn tại');
    });

    test('should handle special characters in credentials', async () => {
      await UserCollection.create({
        name: 'special!@#$%^&*()',
        email: 'special@example.com',
        password: 'páśśwörd123!@#',
        role: 'user'
      });

      const response = await request(app)
        .post('/login')
        .send({
          username: 'special!@#$%^&*()',
          password: 'páśśwörd123!@#'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe('special!@#$%^&*()');
    });
  });

  // TEST 9: Edge Cases
  describe('Edge Cases', () => {
    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/login')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Username and password required');
    });

    test('should handle null and undefined values', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: null,
          password: undefined
        })
        .expect(400);

      expect(response.body.error).toBe('Username and password required');
    });

    test('should handle case sensitivity in username', async () => {
      await UserCollection.create({
        name: 'CaseSensitive',
        email: 'case@example.com',
        password: 'password123',
        role: 'user'
      });

      // Exact case should work
      await request(app)
        .post('/login')
        .send({
          username: 'CaseSensitive',
          password: 'password123'
        })
        .expect(200);

      // Different case should fail
      await request(app)
        .post('/login')
        .send({
          username: 'casesensitive',
          password: 'password123'
        })
        .expect(401);
    });

    test('should handle whitespace in credentials', async () => {
      await UserCollection.create({
        name: 'whitespacetest',
        email: 'whitespace@example.com',
        password: 'password123',
        role: 'user'
      });

      // Leading/trailing whitespace should be handled
      const response = await request(app)
        .post('/login')
        .send({
          username: '  whitespacetest  ',
          password: '  password123  '
        })
        .expect(401); // Should fail unless app trims whitespace

      expect(response.body.error).toBe('Tài khoản không tồn tại');
    });
  });

  // TEST 10: Performance Tests
  describe('Performance Tests', () => {
    test('should handle multiple rapid login attempts', async () => {
      await UserCollection.create({
        name: 'rapidtest',
        email: 'rapid@example.com',
        password: 'password123',
        role: 'user'
      });

      const promises = Array(20).fill().map(() => 
        request(app)
          .post('/login')
          .send({
            username: 'rapidtest',
            password: 'password123'
          })
      );

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    test('should handle login with large user database', async () => {
      // Create many users
      const users = Array(100).fill().map((_, i) => ({
        name: `user${i}`,
        email: `user${i}@example.com`,
        password: 'password123',
        role: 'user'
      }));

      await UserCollection.insertMany(users);

      // Login should still be fast
      const start = Date.now();
      const response = await request(app)
        .post('/login')
        .send({
          username: 'user50',
          password: 'password123'
        })
        .expect(200);
      const duration = Date.now() - start;

      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});