
import { MongoClient, Db, Collection } from 'mongodb';
import type { User, Application, UserApp, ActivityLog, LicenseKey, WebhookConfig } from '../shared/schema.js';

interface MongoUser extends Omit<User, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

interface MongoApplication extends Omit<Application, 'createdAt'> {
  createdAt: Date;
}

interface MongoUserApp extends Omit<UserApp, 'createdAt' | 'lastLogin' | 'expiryDate'> {
  createdAt: Date;
  lastLogin: Date | null;
  expiryDate: Date | null;
}

interface MongoActivityLog extends Omit<ActivityLog, 'timestamp'> {
  timestamp: Date;
}

interface MongoLicenseKey extends Omit<LicenseKey, 'createdAt' | 'expiryDate'> {
  createdAt: Date;
  expiryDate: Date | null;
}

interface MongoWebhookConfig extends Omit<WebhookConfig, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

interface MongoAppUser {
  id: number;
  applicationId: number;
  username: string;
  email: string | null;
  password: string;
  hwid: string | null;
  isActive: boolean;
  isPaused: boolean;
  expiresAt: Date | null;
  lastLogin: Date | null;
  loginAttempts: number;
  lastLoginAttempt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class MongoStorage {
  private client: MongoClient;
  private db: Db;
  private users: Collection<MongoUser>;
  private applications: Collection<MongoApplication>;
  private userApps: Collection<MongoUserApp>;
  private appUsers: Collection<MongoAppUser>;
  private activityLogs: Collection<MongoActivityLog>;
  private licenseKeys: Collection<MongoLicenseKey>;
  private webhookConfigs: Collection<MongoWebhookConfig>;

  constructor() {
    let mongoUrl = process.env.MONGODB_URL || process.env.DATABASE_URL;
    
    if (!mongoUrl) {
      throw new Error('MongoDB connection string not found. Please set MONGODB_URL in Replit Secrets.');
    }
    
    // If SRV format fails, we'll try standard format as fallback
    const hasSrv = mongoUrl.includes('mongodb+srv://');
    if (hasSrv) {
      // Create fallback standard connection string
      const fallbackUrl = mongoUrl
        .replace('mongodb+srv://', 'mongodb://')
        .replace('@nexxauth-cluster.ohgfre3.mongodb.net/', '@nexxauth-cluster-shard-00-00.ohgfre3.mongodb.net:27017,nexxauth-cluster-shard-00-01.ohgfre3.mongodb.net:27017,nexxauth-cluster-shard-00-02.ohgfre3.mongodb.net:27017/')
        .replace('?retryWrites=true&w=majority&appName=nexxauth-cluster', '?ssl=true&replicaSet=atlas-default&authSource=admin&retryWrites=true&w=majority');
    }
    
    console.log('Connecting to MongoDB:', mongoUrl.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs
    
    // Configure client with additional options for better connectivity
    this.client = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
    });
    this.db = this.client.db();
    
    this.users = this.db.collection<MongoUser>('users');
    this.applications = this.db.collection<MongoApplication>('applications');
    this.userApps = this.db.collection<MongoUserApp>('user_apps');
    this.appUsers = this.db.collection<MongoAppUser>('app_users');
    this.activityLogs = this.db.collection<MongoActivityLog>('activity_logs');
    this.licenseKeys = this.db.collection<MongoLicenseKey>('license_keys');
    this.webhookConfigs = this.db.collection<MongoWebhookConfig>('webhook_configs');
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('Connected to MongoDB');
      
      // Test the connection
      await this.db.admin().ping();
      console.log('MongoDB connection verified');
      
      // Create indexes
      await this.users.createIndex({ email: 1 }, { unique: true });
      await this.applications.createIndex({ userId: 1 });
      await this.userApps.createIndex({ applicationId: 1, username: 1 }, { unique: true });
      await this.appUsers.createIndex({ applicationId: 1, username: 1 }, { unique: true });
      await this.activityLogs.createIndex({ applicationId: 1, timestamp: -1 });
      await this.licenseKeys.createIndex({ applicationId: 1 });
      await this.webhookConfigs.createIndex({ applicationId: 1 });
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      
      if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
        console.error('DNS resolution failed. Trying fallback connection method...');
        
        // Try fallback with standard MongoDB format
        const mongoUrl = process.env.MONGODB_URL || process.env.DATABASE_URL;
        if (mongoUrl && mongoUrl.includes('mongodb+srv://')) {
          const fallbackUrl = mongoUrl
            .replace('mongodb+srv://', 'mongodb://')
            .replace('@nexxauth-cluster.ohgfre3.mongodb.net/', '@nexxauth-cluster-shard-00-00.ohgfre3.mongodb.net:27017,nexxauth-cluster-shard-00-01.ohgfre3.mongodb.net:27017,nexxauth-cluster-shard-00-02.ohgfre3.mongodb.net:27017/')
            .replace('?retryWrites=true&w=majority&appName=nexxauth-cluster', '?ssl=true&replicaSet=atlas-default&authSource=admin&retryWrites=true&w=majority');
          
          console.log('Trying fallback connection...');
          this.client = new MongoClient(fallbackUrl, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            retryWrites: true,
          });
          
          try {
            await this.client.connect();
            console.log('✅ Connected to MongoDB using fallback method');
            await this.db.admin().ping();
            return;
          } catch (fallbackError) {
            console.error('❌ Fallback connection also failed:', fallbackError);
          }
        }
        
        console.error('TROUBLESHOOTING STEPS:');
        console.error('1. Check MongoDB Atlas cluster status (ensure it\'s not paused)');
        console.error('2. Verify Network Access allows your IP or 0.0.0.0/0');
        console.error('3. Confirm database user exists and has proper permissions');
        console.error('4. Try connecting from MongoDB Compass to test the connection');
      }
      
      throw error;
    }
  }

  async disconnect() {
    await this.client.close();
  }

  // User methods
  async getUser(id: string): Promise<User | null> {
    const user = await this.users.findOne({ id });
    if (!user) return null;
    
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.users.findOne({ email });
    if (!user) return null;
    
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    const mongoUser: MongoUser = {
      ...user,
      createdAt: now,
      updatedAt: now
    };
    
    await this.users.insertOne(mongoUser);
    
    return {
      ...mongoUser,
      createdAt: mongoUser.createdAt.toISOString(),
      updatedAt: mongoUser.updatedAt.toISOString()
    };
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const now = new Date();
    const mongoUpdates = {
      ...updates,
      updatedAt: now
    };
    
    const result = await this.users.findOneAndUpdate(
      { id },
      { $set: mongoUpdates },
      { returnDocument: 'after' }
    );
    
    if (!result.value) return null;
    
    return {
      ...result.value,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString()
    };
  }

  async upsertUser(userData: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    
    // Try to find existing user
    const existingUser = await this.users.findOne({ id: userData.id });
    
    if (existingUser) {
      // Update existing user
      const mongoUpdates = {
        ...userData,
        updatedAt: now
      };
      
      const result = await this.users.findOneAndUpdate(
        { id: userData.id },
        { $set: mongoUpdates },
        { returnDocument: 'after' }
      );
      
      return {
        ...result.value!,
        createdAt: result.value!.createdAt.toISOString(),
        updatedAt: result.value!.updatedAt.toISOString()
      };
    } else {
      // Create new user
      const mongoUser: MongoUser = {
        ...userData,
        createdAt: now,
        updatedAt: now
      };
      
      await this.users.insertOne(mongoUser);
      
      return {
        ...mongoUser,
        createdAt: mongoUser.createdAt.toISOString(),
        updatedAt: mongoUser.updatedAt.toISOString()
      };
    }
  }

  // Application methods
  async createApplication(userId: string, app: any): Promise<Application> {
    const now = new Date();
    const mongoApp: MongoApplication = {
      id: Date.now(), // Simple ID generation
      userId,
      name: app.name,
      description: app.description || '',
      apiKey: this.generateApiKey(),
      isActive: true,
      version: app.version || '1.0.0',
      hwidLockEnabled: app.hwidLockEnabled || false,
      loginSuccessMessage: app.loginSuccessMessage || 'Login successful!',
      loginFailedMessage: app.loginFailedMessage || 'Invalid credentials!',
      accountDisabledMessage: app.accountDisabledMessage || 'Account is disabled!',
      accountExpiredMessage: app.accountExpiredMessage || 'Account has expired!',
      versionMismatchMessage: app.versionMismatchMessage || 'Version mismatch!',
      hwidMismatchMessage: app.hwidMismatchMessage || 'Hardware ID mismatch!',
      createdAt: now
    };
    
    await this.applications.insertOne(mongoApp);
    
    return {
      ...mongoApp,
      createdAt: mongoApp.createdAt.toISOString()
    };
  }

  async getAllApplications(userId: string): Promise<Application[]> {
    const apps = await this.applications.find({ userId }).toArray();
    return apps.map(app => ({
      ...app,
      createdAt: app.createdAt.toISOString()
    }));
  }

  async getApplicationsByOwner(ownerId: string): Promise<Application[]> {
    const apps = await this.applications.find({ ownerId }).toArray();
    return apps.map(app => ({
      ...app,
      createdAt: app.createdAt.toISOString()
    }));
  }

  async getApplication(id: number): Promise<Application | undefined> {
    const app = await this.applications.findOne({ id });
    if (!app) return undefined;
    
    return {
      ...app,
      createdAt: app.createdAt.toISOString()
    };
  }

  async getApplicationByApiKey(apiKey: string): Promise<Application | undefined> {
    const app = await this.applications.findOne({ apiKey });
    if (!app) return undefined;
    
    return {
      ...app,
      createdAt: app.createdAt.toISOString()
    };
  }

  async updateApplication(id: number, updates: any): Promise<Application | undefined> {
    const result = await this.applications.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    
    if (!result.value) return undefined;
    
    return {
      ...result.value,
      createdAt: result.value.createdAt.toISOString()
    };
  }

  async deleteApplication(id: number): Promise<boolean> {
    const result = await this.applications.deleteOne({ id });
    return result.deletedCount > 0;
  }

  // Helper method to generate API keys
  private generateApiKey(): string {
    return 'pk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // UserApp methods
  async createUserApp(userApp: Omit<UserApp, 'createdAt' | 'lastLogin'>): Promise<UserApp> {
    const now = new Date();
    const mongoUserApp: MongoUserApp = {
      ...userApp,
      createdAt: now,
      lastLogin: null,
      expiryDate: userApp.expiryDate ? new Date(userApp.expiryDate) : null
    };
    
    await this.userApps.insertOne(mongoUserApp);
    
    return {
      ...mongoUserApp,
      createdAt: mongoUserApp.createdAt.toISOString(),
      lastLogin: mongoUserApp.lastLogin?.toISOString() || null,
      expiryDate: mongoUserApp.expiryDate?.toISOString() || null
    };
  }

  async getUserApp(applicationId: string, username: string): Promise<UserApp | null> {
    const userApp = await this.userApps.findOne({ applicationId, username });
    if (!userApp) return null;
    
    return {
      ...userApp,
      createdAt: userApp.createdAt.toISOString(),
      lastLogin: userApp.lastLogin?.toISOString() || null,
      expiryDate: userApp.expiryDate?.toISOString() || null
    };
  }

  async getUserAppsByApplication(applicationId: string): Promise<UserApp[]> {
    const userApps = await this.userApps.find({ applicationId }).toArray();
    return userApps.map(userApp => ({
      ...userApp,
      createdAt: userApp.createdAt.toISOString(),
      lastLogin: userApp.lastLogin?.toISOString() || null,
      expiryDate: userApp.expiryDate?.toISOString() || null
    }));
  }

  async updateUserApp(applicationId: string, username: string, updates: Partial<UserApp>): Promise<UserApp | null> {
    const mongoUpdates = {
      ...updates,
      ...(updates.lastLogin && { lastLogin: new Date(updates.lastLogin) }),
      ...(updates.expiryDate && { expiryDate: new Date(updates.expiryDate) })
    };
    
    const result = await this.userApps.findOneAndUpdate(
      { applicationId, username },
      { $set: mongoUpdates },
      { returnDocument: 'after' }
    );
    
    if (!result.value) return null;
    
    return {
      ...result.value,
      createdAt: result.value.createdAt.toISOString(),
      lastLogin: result.value.lastLogin?.toISOString() || null,
      expiryDate: result.value.expiryDate?.toISOString() || null
    };
  }

  async deleteUserApp(applicationId: string, username: string): Promise<boolean> {
    const result = await this.userApps.deleteOne({ applicationId, username });
    return result.deletedCount > 0;
  }

  // Activity Log methods
  async createActivityLog(log: Omit<ActivityLog, 'timestamp'>): Promise<ActivityLog> {
    const now = new Date();
    const mongoLog: MongoActivityLog = {
      ...log,
      timestamp: now
    };
    
    await this.activityLogs.insertOne(mongoLog);
    
    return {
      ...mongoLog,
      timestamp: mongoLog.timestamp.toISOString()
    };
  }

  async getActivityLogs(applicationId: string, limit = 100): Promise<ActivityLog[]> {
    const logs = await this.activityLogs
      .find({ applicationId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString()
    }));
  }

  // License Key methods
  async createLicenseKey(key: Omit<LicenseKey, 'createdAt'>): Promise<LicenseKey> {
    const now = new Date();
    const mongoKey: MongoLicenseKey = {
      ...key,
      createdAt: now,
      expiryDate: key.expiryDate ? new Date(key.expiryDate) : null
    };
    
    await this.licenseKeys.insertOne(mongoKey);
    
    return {
      ...mongoKey,
      createdAt: mongoKey.createdAt.toISOString(),
      expiryDate: mongoKey.expiryDate?.toISOString() || null
    };
  }

  async getLicenseKeysByApplication(applicationId: string): Promise<LicenseKey[]> {
    const keys = await this.licenseKeys.find({ applicationId }).toArray();
    return keys.map(key => ({
      ...key,
      createdAt: key.createdAt.toISOString(),
      expiryDate: key.expiryDate?.toISOString() || null
    }));
  }

  async getLicenseKey(applicationId: string, keyValue: string): Promise<LicenseKey | null> {
    const key = await this.licenseKeys.findOne({ applicationId, key: keyValue });
    if (!key) return null;
    
    return {
      ...key,
      createdAt: key.createdAt.toISOString(),
      expiryDate: key.expiryDate?.toISOString() || null
    };
  }

  async updateLicenseKey(applicationId: string, keyValue: string, updates: Partial<LicenseKey>): Promise<LicenseKey | null> {
    const mongoUpdates = {
      ...updates,
      ...(updates.expiryDate && { expiryDate: new Date(updates.expiryDate) })
    };
    
    const result = await this.licenseKeys.findOneAndUpdate(
      { applicationId, key: keyValue },
      { $set: mongoUpdates },
      { returnDocument: 'after' }
    );
    
    if (!result.value) return null;
    
    return {
      ...result.value,
      createdAt: result.value.createdAt.toISOString(),
      expiryDate: result.value.expiryDate?.toISOString() || null
    };
  }

  async deleteLicenseKey(applicationId: string, keyValue: string): Promise<boolean> {
    const result = await this.licenseKeys.deleteOne({ applicationId, key: keyValue });
    return result.deletedCount > 0;
  }

  // Webhook methods
  async createWebhookConfig(config: Omit<WebhookConfig, 'createdAt' | 'updatedAt'>): Promise<WebhookConfig> {
    const now = new Date();
    const mongoConfig: MongoWebhookConfig = {
      ...config,
      createdAt: now,
      updatedAt: now
    };
    
    await this.webhookConfigs.insertOne(mongoConfig);
    
    return {
      ...mongoConfig,
      createdAt: mongoConfig.createdAt.toISOString(),
      updatedAt: mongoConfig.updatedAt.toISOString()
    };
  }

  async getWebhookConfigs(applicationId: string): Promise<WebhookConfig[]> {
    const configs = await this.webhookConfigs.find({ applicationId }).toArray();
    return configs.map(config => ({
      ...config,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString()
    }));
  }

  async updateWebhookConfig(id: string, updates: Partial<WebhookConfig>): Promise<WebhookConfig | null> {
    const now = new Date();
    const mongoUpdates = {
      ...updates,
      updatedAt: now
    };
    
    const result = await this.webhookConfigs.findOneAndUpdate(
      { id },
      { $set: mongoUpdates },
      { returnDocument: 'after' }
    );
    
    if (!result.value) return null;
    
    return {
      ...result.value,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString()
    };
  }

  async deleteWebhookConfig(id: string): Promise<boolean> {
    const result = await this.webhookConfigs.deleteOne({ id });
    return result.deletedCount > 0;
  }

  // Additional methods required by routes.ts
  async getAllAppUsers(applicationId: number): Promise<any[]> {
    const users = await this.appUsers.find({ applicationId }).toArray();
    return users.map(user => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString() || null,
      expiresAt: user.expiresAt?.toISOString() || null,
      lastLoginAttempt: user.lastLoginAttempt?.toISOString() || null
    }));
  }

  async getActiveSessions(applicationId: number): Promise<any[]> {
    // Return empty array for now - implement active sessions later
    return [];
  }

  async getActivityLogs(applicationId: number, limit?: number): Promise<any[]> {
    const query = this.activityLogs.find({ applicationId }).sort({ timestamp: -1 });
    if (limit) {
      query.limit(limit);
    }
    const logs = await query.toArray();
    return logs.map(log => ({
      ...log,
      createdAt: log.timestamp.toISOString()
    }));
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    const bcrypt = await import('bcrypt');
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async getAllUsers(): Promise<User[]> {
    const users = await this.users.find({}).toArray();
    return users.map(user => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    }));
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.users.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async getUserPermissions(userId: string): Promise<any> {
    // Return null for now - implement permissions later
    return null;
  }
}

export const mongoStorage = new MongoStorage();
