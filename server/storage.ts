import {
  users,
  applications,
  appUsers,
  licenseKeys,
  webhooks,
  blacklist,
  activityLogs,
  activeSessions,
  type User,
  type UpsertUser,
  type Application,
  type InsertApplication,
  type UpdateApplication,
  type LicenseKey,
  type InsertLicenseKey,
  type AppUser,
  type InsertAppUser,
  type UpdateAppUser,
  type Webhook,
  type InsertWebhook,
  type BlacklistEntry,
  type InsertBlacklistEntry,
  type ActivityLog,
  type InsertActivityLog,
  type ActiveSession,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";

// Interface for storage operations
export interface IStorage {
  // User operations for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Application methods
  getApplication(id: number): Promise<Application | undefined>;
  getApplicationByApiKey(apiKey: string): Promise<Application | undefined>;
  createApplication(userId: string, app: InsertApplication): Promise<Application>;
  updateApplication(id: number, updates: UpdateApplication): Promise<Application | undefined>;
  deleteApplication(id: number): Promise<boolean>;
  getAllApplications(userId: string): Promise<Application[]>;
  
  // License Key methods
  createLicenseKey(applicationId: number, license: InsertLicenseKey): Promise<LicenseKey>;
  getLicenseKey(id: number): Promise<LicenseKey | undefined>;
  getLicenseKeyByKey(licenseKey: string): Promise<LicenseKey | undefined>;
  getAllLicenseKeys(applicationId: number): Promise<LicenseKey[]>;
  updateLicenseKey(id: number, updates: Partial<InsertLicenseKey>): Promise<LicenseKey | undefined>;
  deleteLicenseKey(id: number): Promise<boolean>;
  validateLicenseKey(licenseKey: string, applicationId: number): Promise<LicenseKey | null>;
  incrementLicenseUsage(licenseKeyId: number): Promise<boolean>;
  decrementLicenseUsage(licenseKeyId: number): Promise<boolean>;
  
  // App User methods (now with license key support)
  getAppUser(id: number): Promise<AppUser | undefined>;
  getAppUserByUsername(applicationId: number, username: string): Promise<AppUser | undefined>;
  getAppUserByEmail(applicationId: number, email: string): Promise<AppUser | undefined>;
  createAppUserWithLicense(applicationId: number, user: InsertAppUser): Promise<AppUser>;
  updateAppUser(id: number, updates: UpdateAppUser): Promise<AppUser | undefined>;
  deleteAppUser(id: number): Promise<boolean>;
  pauseAppUser(id: number): Promise<boolean>;
  unpauseAppUser(id: number): Promise<boolean>;
  resetAppUserHwid(id: number): Promise<boolean>;
  setAppUserHwid(id: number, hwid: string): Promise<boolean>;
  getAllAppUsers(applicationId: number): Promise<AppUser[]>;
  
  // Webhook methods
  createWebhook(userId: string, webhook: InsertWebhook): Promise<Webhook>;
  getUserWebhooks(userId: string): Promise<Webhook[]>;
  updateWebhook(id: number, updates: Partial<InsertWebhook>): Promise<Webhook | undefined>;
  deleteWebhook(id: number): Promise<boolean>;
  
  // Blacklist methods
  createBlacklistEntry(entry: InsertBlacklistEntry): Promise<BlacklistEntry>;
  getBlacklistEntries(applicationId?: number): Promise<BlacklistEntry[]>;
  checkBlacklist(applicationId: number, type: string, value: string): Promise<BlacklistEntry | undefined>;
  deleteBlacklistEntry(id: number): Promise<boolean>;
  
  // Activity logging methods
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(applicationId: number, limit?: number): Promise<ActivityLog[]>;
  getUserActivityLogs(appUserId: number, limit?: number): Promise<ActivityLog[]>;
  
  // Session tracking methods
  createActiveSession(session: Omit<ActiveSession, 'id' | 'createdAt' | 'lastActivity'>): Promise<ActiveSession>;
  getActiveSessions(applicationId: number): Promise<ActiveSession[]>;
  updateSessionActivity(sessionToken: string): Promise<boolean>;
  endSession(sessionToken: string): Promise<boolean>;
  
  // Auth methods
  validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  // User operations for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Set special permissions for mohitsindhu121@gmail.com
    const insertData: any = {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      role: 'user',
      permissions: [],
      isActive: true,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt
    };

    if (userData.email === 'mohitsindhu121@gmail.com') {
      insertData.role = 'owner';
      insertData.permissions = [
        'edit_code', 
        'manage_users', 
        'manage_applications', 
        'view_all_data', 
        'delete_applications', 
        'manage_permissions', 
        'access_admin_panel'
      ];
      insertData.isActive = true;
    }

    const [user] = await db
      .insert(users)
      .values(insertData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: insertData.email,
          firstName: insertData.firstName,
          lastName: insertData.lastName,
          profileImageUrl: insertData.profileImageUrl,
          role: insertData.role,
          permissions: insertData.permissions,
          isActive: insertData.isActive,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Application methods
  async getApplication(id: number): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    return app;
  }

  async getApplicationByApiKey(apiKey: string): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.apiKey, apiKey));
    return app;
  }

  async createApplication(userId: string, insertApp: InsertApplication): Promise<Application> {
    const apiKey = `phantom_${nanoid(32)}`;
    const [app] = await db
      .insert(applications)
      .values({
        ...insertApp,
        userId,
        apiKey,
      })
      .returning();
    return app;
  }

  async updateApplication(id: number, updates: UpdateApplication): Promise<Application | undefined> {
    const [app] = await db
      .update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return app;
  }

  async deleteApplication(id: number): Promise<boolean> {
    const result = await db.delete(applications).where(eq(applications.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllApplications(userId: string): Promise<Application[]> {
    return await db.select().from(applications).where(eq(applications.userId, userId));
  }

  // License Key methods
  async createLicenseKey(applicationId: number, license: InsertLicenseKey): Promise<LicenseKey> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + license.validityDays);
    
    const [licenseKey] = await db
      .insert(licenseKeys)
      .values({
        applicationId,
        licenseKey: license.licenseKey,
        maxUsers: license.maxUsers,
        validityDays: license.validityDays,
        description: license.description || null,
        expiresAt,
      })
      .returning();
    return licenseKey;
  }

  async getLicenseKey(id: number): Promise<LicenseKey | undefined> {
    const [license] = await db.select().from(licenseKeys).where(eq(licenseKeys.id, id));
    return license;
  }

  async getLicenseKeyByKey(licenseKey: string): Promise<LicenseKey | undefined> {
    const [license] = await db.select().from(licenseKeys).where(eq(licenseKeys.licenseKey, licenseKey));
    return license;
  }

  async getAllLicenseKeys(applicationId: number): Promise<LicenseKey[]> {
    return await db.select().from(licenseKeys).where(eq(licenseKeys.applicationId, applicationId));
  }

  async updateLicenseKey(id: number, updates: Partial<InsertLicenseKey>): Promise<LicenseKey | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    
    // Recalculate expiry if validity days changed
    if (updates.validityDays) {
      const currentLicense = await this.getLicenseKey(id);
      if (currentLicense) {
        const createdAt = new Date(currentLicense.createdAt);
        const newExpiresAt = new Date(createdAt);
        newExpiresAt.setDate(newExpiresAt.getDate() + updates.validityDays);
        updateData.expiresAt = newExpiresAt;
      }
    }
    
    const [license] = await db
      .update(licenseKeys)
      .set(updateData)
      .where(eq(licenseKeys.id, id))
      .returning();
    return license;
  }

  async deleteLicenseKey(id: number): Promise<boolean> {
    const result = await db.delete(licenseKeys).where(eq(licenseKeys.id, id));
    return (result.rowCount || 0) > 0;
  }

  async validateLicenseKey(licenseKey: string, applicationId: number): Promise<LicenseKey | null> {
    const [license] = await db
      .select()
      .from(licenseKeys)
      .where(
        and(
          eq(licenseKeys.licenseKey, licenseKey),
          eq(licenseKeys.applicationId, applicationId),
          eq(licenseKeys.isActive, true)
        )
      );
    
    if (!license) return null;
    
    // Check if license has expired
    if (new Date() > new Date(license.expiresAt)) {
      return null;
    }
    
    // Check if license has reached max users
    if (license.currentUsers >= license.maxUsers) {
      return null;
    }
    
    return license;
  }

  async incrementLicenseUsage(licenseKeyId: number): Promise<boolean> {
    // Get current count and increment
    const [license] = await db.select().from(licenseKeys).where(eq(licenseKeys.id, licenseKeyId));
    if (!license) return false;
    
    const result = await db
      .update(licenseKeys)
      .set({ 
        currentUsers: license.currentUsers + 1,
        updatedAt: new Date()
      })
      .where(eq(licenseKeys.id, licenseKeyId));
    return (result.rowCount || 0) > 0;
  }

  async decrementLicenseUsage(licenseKeyId: number): Promise<boolean> {
    // Get current count and decrement
    const [license] = await db.select().from(licenseKeys).where(eq(licenseKeys.id, licenseKeyId));
    if (!license) return false;
    
    const result = await db
      .update(licenseKeys)
      .set({ 
        currentUsers: Math.max(0, license.currentUsers - 1),
        updatedAt: new Date()
      })
      .where(eq(licenseKeys.id, licenseKeyId));
    return (result.rowCount || 0) > 0;
  }

  // App User methods (updated with license support)
  async getAppUser(id: number): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, id));
    return user;
  }

  async getAppUserByUsername(applicationId: number, username: string): Promise<AppUser | undefined> {
    const [user] = await db
      .select()
      .from(appUsers)
      .where(and(eq(appUsers.applicationId, applicationId), eq(appUsers.username, username)));
    return user;
  }

  async getAppUserByEmail(applicationId: number, email: string): Promise<AppUser | undefined> {
    if (!email) return undefined;
    const [user] = await db
      .select()
      .from(appUsers)
      .where(and(eq(appUsers.applicationId, applicationId), eq(appUsers.email, email)));
    return user;
  }

  async createAppUserWithLicense(applicationId: number, insertUser: InsertAppUser): Promise<AppUser> {
    // Validate license key first
    const licenseKey = await this.validateLicenseKey(insertUser.licenseKey!, applicationId);
    if (!licenseKey) {
      throw new Error("Invalid or expired license key");
    }

    const hashedPassword = await this.hashPassword(insertUser.password);
    
    // Set user expiry based on license expiry
    const userExpiresAt = new Date(licenseKey.expiresAt);
    
    const [user] = await db
      .insert(appUsers)
      .values({
        applicationId,
        licenseKeyId: licenseKey.id,
        username: insertUser.username,
        password: hashedPassword,
        email: insertUser.email || null,
        hwid: insertUser.hwid || null,
        expiresAt: userExpiresAt,
      })
      .returning();

    // Increment license usage
    await this.incrementLicenseUsage(licenseKey.id);
    
    return user;
  }

  // Create app user without license key (for admin creation)
  async createAppUser(applicationId: number, insertUser: InsertAppUser): Promise<AppUser> {
    const hashedPassword = await this.hashPassword(insertUser.password);
    
    // Parse expiresAt if provided
    let userExpiresAt = null;
    if (insertUser.expiresAt) {
      userExpiresAt = new Date(insertUser.expiresAt);
    }
    
    const [user] = await db
      .insert(appUsers)
      .values({
        applicationId,
        licenseKeyId: null, // No license key for admin creation
        username: insertUser.username,
        password: hashedPassword,
        email: insertUser.email || null,
        hwid: insertUser.hwid || null,
        expiresAt: userExpiresAt,
      })
      .returning();
    
    return user;
  }

  async updateAppUser(id: number, updates: UpdateAppUser): Promise<AppUser | undefined> {
    // If password is being updated, hash it first
    if (updates.password) {
      updates.password = await this.hashPassword(updates.password);
    }
    
    // Handle date conversion for expiresAt
    const processedUpdates: any = { ...updates };
    if (processedUpdates.expiresAt && typeof processedUpdates.expiresAt === 'string') {
      processedUpdates.expiresAt = new Date(processedUpdates.expiresAt);
    }
    
    const [user] = await db
      .update(appUsers)
      .set(processedUpdates)
      .where(eq(appUsers.id, id))
      .returning();
    return user;
  }

  async pauseAppUser(id: number): Promise<boolean> {
    const result = await db
      .update(appUsers)
      .set({ isPaused: true })
      .where(eq(appUsers.id, id));
    return (result.rowCount || 0) > 0;
  }

  async unpauseAppUser(id: number): Promise<boolean> {
    const result = await db
      .update(appUsers)
      .set({ isPaused: false })
      .where(eq(appUsers.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteAppUser(id: number): Promise<boolean> {
    const result = await db.delete(appUsers).where(eq(appUsers.id, id));
    return (result.rowCount || 0) > 0;
  }

  async resetAppUserHwid(id: number): Promise<boolean> {
    const result = await db
      .update(appUsers)
      .set({ hwid: null })
      .where(eq(appUsers.id, id));
    return (result.rowCount || 0) > 0;
  }

  async setAppUserHwid(id: number, hwid: string): Promise<boolean> {
    const result = await db
      .update(appUsers)
      .set({ hwid })
      .where(eq(appUsers.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllAppUsers(applicationId: number): Promise<AppUser[]> {
    return await db.select().from(appUsers).where(eq(appUsers.applicationId, applicationId));
  }

  // Webhook methods
  async createWebhook(userId: string, webhook: InsertWebhook): Promise<Webhook> {
    const [newWebhook] = await db
      .insert(webhooks)
      .values({ ...webhook, userId })
      .returning();
    return newWebhook;
  }

  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    return await db.select().from(webhooks).where(eq(webhooks.userId, userId));
  }

  async updateWebhook(id: number, updates: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const [webhook] = await db
      .update(webhooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();
    return webhook;
  }

  async deleteWebhook(id: number): Promise<boolean> {
    const result = await db.delete(webhooks).where(eq(webhooks.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Blacklist methods
  async createBlacklistEntry(entry: InsertBlacklistEntry): Promise<BlacklistEntry> {
    const [newEntry] = await db
      .insert(blacklist)
      .values(entry)
      .returning();
    return newEntry;
  }

  async getBlacklistEntries(applicationId?: number): Promise<BlacklistEntry[]> {
    if (applicationId) {
      return await db.select().from(blacklist).where(eq(blacklist.applicationId, applicationId));
    }
    return await db.select().from(blacklist);
  }

  async checkBlacklist(applicationId: number, type: string, value: string): Promise<BlacklistEntry | undefined> {
    const [entry] = await db
      .select()
      .from(blacklist)
      .where(
        and(
          eq(blacklist.applicationId, applicationId),
          eq(blacklist.type, type),
          eq(blacklist.value, value),
          eq(blacklist.isActive, true)
        )
      );
    return entry;
  }

  async deleteBlacklistEntry(id: number): Promise<boolean> {
    const result = await db.delete(blacklist).where(eq(blacklist.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Activity logging methods
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db
      .insert(activityLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getActivityLogs(applicationId: number, limit: number = 100): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.applicationId, applicationId))
      .orderBy(activityLogs.createdAt)
      .limit(limit);
  }

  async getUserActivityLogs(appUserId: number, limit: number = 100): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.appUserId, appUserId))
      .orderBy(activityLogs.createdAt)
      .limit(limit);
  }

  // Session tracking methods
  async createActiveSession(session: Omit<ActiveSession, 'id' | 'createdAt' | 'lastActivity'>): Promise<ActiveSession> {
    const [newSession] = await db
      .insert(activeSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getActiveSessions(applicationId: number): Promise<ActiveSession[]> {
    return await db
      .select()
      .from(activeSessions)
      .where(
        and(
          eq(activeSessions.applicationId, applicationId),
          eq(activeSessions.isActive, true)
        )
      );
  }

  async updateSessionActivity(sessionToken: string): Promise<boolean> {
    const result = await db
      .update(activeSessions)
      .set({ lastActivity: new Date() })
      .where(eq(activeSessions.sessionToken, sessionToken));
    return (result.rowCount || 0) > 0;
  }

  async endSession(sessionToken: string): Promise<boolean> {
    const result = await db
      .update(activeSessions)
      .set({ isActive: false })
      .where(eq(activeSessions.sessionToken, sessionToken));
    return (result.rowCount || 0) > 0;
  }

  // Auth methods
  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }
}

// In-memory storage implementation
class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private applications: Map<number, Application> = new Map();
  private licenseKeys: Map<number, LicenseKey> = new Map();
  private appUsers: Map<number, AppUser> = new Map();
  private webhooks: Map<number, Webhook> = new Map();
  private blacklist: Map<number, BlacklistEntry> = new Map();
  private activityLogs: Map<number, ActivityLog> = new Map();
  private activeSessions: Map<number, ActiveSession> = new Map();
  
  private nextId = 1;

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      id: userData.id,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      role: userData.email === 'mohitsindhu121@gmail.com' ? 'owner' : 'user',
      permissions: userData.email === 'mohitsindhu121@gmail.com' ? [
        'edit_code', 'manage_users', 'manage_applications', 
        'view_all_data', 'delete_applications', 'manage_permissions', 'access_admin_panel'
      ] : [],
      isActive: true,
      createdAt: userData.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Application methods
  async getApplication(id: number): Promise<Application | undefined> {
    return this.applications.get(id);
  }

  async getApplicationByApiKey(apiKey: string): Promise<Application | undefined> {
    return Array.from(this.applications.values()).find(app => app.apiKey === apiKey);
  }

  async createApplication(userId: string, app: InsertApplication): Promise<Application> {
    const apiKey = `nexx_${Math.random().toString(36).substring(2, 34)}`;
    const application: Application = {
      id: this.nextId++,
      name: app.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      description: app.description || null,
      apiKey,
      version: app.version || "1.0.0",
      hwidLockEnabled: app.hwidLockEnabled || false,
      loginSuccessMessage: app.loginSuccessMessage || "Login successful",
      loginFailedMessage: app.loginFailedMessage || "Login failed",
      accountDisabledMessage: app.accountDisabledMessage || "Account disabled",
      accountExpiredMessage: app.accountExpiredMessage || "Account expired",
      versionMismatchMessage: app.versionMismatchMessage || "Version mismatch",
      hwidMismatchMessage: app.hwidMismatchMessage || "Hardware ID mismatch",
    };
    this.applications.set(application.id, application);
    return application;
  }

  async updateApplication(id: number, updates: UpdateApplication): Promise<Application | undefined> {
    const app = this.applications.get(id);
    if (!app) return undefined;
    
    const updatedApp = { ...app, ...updates, updatedAt: new Date() };
    this.applications.set(id, updatedApp);
    return updatedApp;
  }

  async deleteApplication(id: number): Promise<boolean> {
    return this.applications.delete(id);
  }

  async getAllApplications(userId: string): Promise<Application[]> {
    return Array.from(this.applications.values()).filter(app => app.userId === userId);
  }

  // License Key methods
  async createLicenseKey(applicationId: number, license: InsertLicenseKey): Promise<LicenseKey> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + license.validityDays);
    
    const key: LicenseKey = {
      id: this.nextId++,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      description: license.description || null,
      applicationId,
      licenseKey: license.licenseKey,
      maxUsers: license.maxUsers,
      currentUsers: 0,
      validityDays: license.validityDays,
      expiresAt: expiresAt,
    };
    this.licenseKeys.set(key.id, key);
    return key;
  }

  async getLicenseKey(id: number): Promise<LicenseKey | undefined> {
    return this.licenseKeys.get(id);
  }

  async getLicenseKeyByKey(licenseKey: string): Promise<LicenseKey | undefined> {
    return Array.from(this.licenseKeys.values()).find(key => key.licenseKey === licenseKey);
  }

  async getAllLicenseKeys(applicationId: number): Promise<LicenseKey[]> {
    return Array.from(this.licenseKeys.values()).filter(key => key.applicationId === applicationId);
  }

  async updateLicenseKey(id: number, updates: Partial<InsertLicenseKey>): Promise<LicenseKey | undefined> {
    const key = this.licenseKeys.get(id);
    if (!key) return undefined;
    
    const updatedKey = { ...key, ...updates, updatedAt: new Date() };
    this.licenseKeys.set(id, updatedKey);
    return updatedKey;
  }

  async deleteLicenseKey(id: number): Promise<boolean> {
    return this.licenseKeys.delete(id);
  }

  async validateLicenseKey(licenseKey: string, applicationId: number): Promise<LicenseKey | null> {
    const key = await this.getLicenseKeyByKey(licenseKey);
    if (!key || key.applicationId !== applicationId || !key.isActive) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;
    return key;
  }

  async incrementLicenseUsage(licenseKeyId: number): Promise<boolean> {
    const key = this.licenseKeys.get(licenseKeyId);
    if (!key) return false;
    key.currentUsers++;
    return true;
  }

  async decrementLicenseUsage(licenseKeyId: number): Promise<boolean> {
    const key = this.licenseKeys.get(licenseKeyId);
    if (!key) return false;
    if (key.currentUsers > 0) key.currentUsers--;
    return true;
  }

  // App User methods
  async getAppUser(id: number): Promise<AppUser | undefined> {
    return this.appUsers.get(id);
  }

  async getAppUserByUsername(applicationId: number, username: string): Promise<AppUser | undefined> {
    return Array.from(this.appUsers.values()).find(user => 
      user.applicationId === applicationId && user.username === username
    );
  }

  async getAppUserByEmail(applicationId: number, email: string): Promise<AppUser | undefined> {
    return Array.from(this.appUsers.values()).find(user => 
      user.applicationId === applicationId && user.email === email
    );
  }

  async createAppUserWithLicense(applicationId: number, user: InsertAppUser): Promise<AppUser> {
    return this.createAppUser(applicationId, user);
  }

  async createAppUser(applicationId: number, insertUser: InsertAppUser): Promise<AppUser> {
    const expiresAt = insertUser.expiresAt ? new Date(insertUser.expiresAt) : null;
    
    const user: AppUser = {
      id: this.nextId++,
      email: insertUser.email,
      isActive: true,
      createdAt: new Date(),
      applicationId,
      expiresAt: expiresAt,
      licenseKeyId: null,
      username: insertUser.username,
      password: insertUser.password,
      isPaused: false,
      hwid: insertUser.hwid || null,
      lastLogin: null,
      loginAttempts: 0,
      lastLoginAttempt: null,
    };
    this.appUsers.set(user.id, user);
    return user;
  }

  async updateAppUser(id: number, updates: UpdateAppUser): Promise<AppUser | undefined> {
    const user = this.appUsers.get(id);
    if (!user) return undefined;
    
    // Handle expiresAt conversion - ensure it's Date or null
    const processedUpdates: any = { ...updates };
    if (updates.expiresAt) {
      processedUpdates.expiresAt = typeof updates.expiresAt === 'string' 
        ? new Date(updates.expiresAt) 
        : updates.expiresAt;
    }
    
    const updatedUser: AppUser = { ...user, ...processedUpdates };
    this.appUsers.set(id, updatedUser);
    return updatedUser;
  }

  async pauseAppUser(id: number): Promise<boolean> {
    const user = this.appUsers.get(id);
    if (!user) return false;
    user.isPaused = true;
    return true;
  }

  async unpauseAppUser(id: number): Promise<boolean> {
    const user = this.appUsers.get(id);
    if (!user) return false;
    user.isPaused = false;
    return true;
  }

  async deleteAppUser(id: number): Promise<boolean> {
    return this.appUsers.delete(id);
  }

  async resetAppUserHwid(id: number): Promise<boolean> {
    const user = this.appUsers.get(id);
    if (!user) return false;
    user.hwid = null;
    return true;
  }

  async setAppUserHwid(id: number, hwid: string): Promise<boolean> {
    const user = this.appUsers.get(id);
    if (!user) return false;
    user.hwid = hwid;
    return true;
  }

  async getAllAppUsers(applicationId: number): Promise<AppUser[]> {
    return Array.from(this.appUsers.values()).filter(user => user.applicationId === applicationId);
  }

  // Webhook methods
  async createWebhook(userId: string, webhook: InsertWebhook): Promise<Webhook> {
    const newWebhook: Webhook = {
      id: this.nextId++,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      url: webhook.url,
      secret: webhook.secret || null,
      events: webhook.events || [],
    };
    this.webhooks.set(newWebhook.id, newWebhook);
    return newWebhook;
  }

  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    return Array.from(this.webhooks.values()).filter(webhook => webhook.userId === userId);
  }

  async updateWebhook(id: number, updates: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return undefined;
    
    const updatedWebhook = { ...webhook, ...updates, updatedAt: new Date() };
    this.webhooks.set(id, updatedWebhook);
    return updatedWebhook;
  }

  async deleteWebhook(id: number): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  // Blacklist methods
  async createBlacklistEntry(entry: InsertBlacklistEntry): Promise<BlacklistEntry> {
    const blacklistEntry: BlacklistEntry = {
      id: this.nextId++,
      isActive: true,
      createdAt: new Date(),
      userId: null,
      value: entry.value,
      type: entry.type,
      applicationId: entry.applicationId || null,
      reason: entry.reason || null,
      createdBy: null,
    };
    this.blacklist.set(blacklistEntry.id, blacklistEntry);
    return blacklistEntry;
  }

  async getBlacklistEntries(applicationId?: number): Promise<BlacklistEntry[]> {
    const entries = Array.from(this.blacklist.values());
    return applicationId ? entries.filter(entry => entry.applicationId === applicationId) : entries;
  }

  async checkBlacklist(applicationId: number, type: string, value: string): Promise<BlacklistEntry | undefined> {
    return Array.from(this.blacklist.values()).find(entry => 
      entry.applicationId === applicationId && entry.type === type && entry.value === value
    );
  }

  async deleteBlacklistEntry(id: number): Promise<boolean> {
    return this.blacklist.delete(id);
  }

  // Activity logging methods
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const activityLog: ActivityLog = {
      id: this.nextId++,
      createdAt: new Date(),
      applicationId: log.applicationId || null,
      hwid: log.hwid || null,
      appUserId: log.appUserId || null,
      event: log.event,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
      metadata: log.metadata || null,
      success: log.success || false,
      errorMessage: log.errorMessage || null,
    };
    this.activityLogs.set(activityLog.id, activityLog);
    return activityLog;
  }

  async getActivityLogs(applicationId: number, limit: number = 100): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter(log => log.applicationId === applicationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getUserActivityLogs(appUserId: number, limit: number = 100): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter(log => log.appUserId === appUserId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Session tracking methods
  async createActiveSession(session: Omit<ActiveSession, 'id' | 'createdAt' | 'lastActivity'>): Promise<ActiveSession> {
    const activeSession: ActiveSession = {
      id: this.nextId++,
      isActive: true,
      createdAt: new Date(),
      applicationId: session.applicationId,
      expiresAt: session.expiresAt,
      hwid: session.hwid,
      appUserId: session.appUserId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      sessionToken: session.sessionToken,
      location: session.location,
      lastActivity: new Date(),
    };
    this.activeSessions.set(activeSession.id, activeSession);
    return activeSession;
  }

  async getActiveSessions(applicationId: number): Promise<ActiveSession[]> {
    return Array.from(this.activeSessions.values()).filter(session => 
      session.applicationId === applicationId && session.isActive
    );
  }

  async updateSessionActivity(sessionToken: string): Promise<boolean> {
    const session = Array.from(this.activeSessions.values()).find(s => s.sessionToken === sessionToken);
    if (!session) return false;
    session.lastActivity = new Date();
    return true;
  }

  async endSession(sessionToken: string): Promise<boolean> {
    const session = Array.from(this.activeSessions.values()).find(s => s.sessionToken === sessionToken);
    if (!session) return false;
    session.isActive = false;
    return true;
  }

  // Auth methods
  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }
}

export const storage = new MemStorage();