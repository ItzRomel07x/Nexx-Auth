import {
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
} from "../shared/schema.js";
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
  
  // App User methods
  getAppUser(id: number): Promise<AppUser | undefined>;
  getAppUserByUsername(applicationId: number, username: string): Promise<AppUser | undefined>;
  getAppUserByEmail(applicationId: number, email: string): Promise<AppUser | undefined>;
  createAppUser(applicationId: number, user: InsertAppUser): Promise<AppUser>;
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

// In-memory storage implementation
export class MemStorage implements IStorage {
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
    const existingUser = this.users.get(userData.id);
    const now = new Date();
    
    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      role: userData.role || 'user',
      permissions: userData.permissions || [],
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: existingUser?.createdAt || now,
      updatedAt: now
    };

    // Set special permissions for mohitsindhu121@gmail.com
    if (userData.email === 'mohitsindhu121@gmail.com') {
      user.role = 'owner';
      user.permissions = [
        'edit_code', 
        'manage_users', 
        'manage_applications', 
        'view_all_data', 
        'delete_applications', 
        'manage_permissions', 
        'access_admin_panel'
      ];
      user.isActive = true;
    }

    this.users.set(userData.id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;

    const updatedUser = {
      ...existingUser,
      ...updates,
      updatedAt: new Date()
    };

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
    for (const app of this.applications.values()) {
      if (app.apiKey === apiKey) {
        return app;
      }
    }
    return undefined;
  }

  async createApplication(userId: string, insertApp: InsertApplication): Promise<Application> {
    const id = this.nextId++;
    const apiKey = `nexx_${nanoid(32)}`;
    const now = new Date();

    const app: Application = {
      id,
      userId,
      name: insertApp.name,
      description: insertApp.description,
      apiKey,
      isActive: true,
      settings: {
        requireHwid: insertApp.settings?.requireHwid ?? false,
        requireVersion: insertApp.settings?.requireVersion ?? false,
        allowedVersion: insertApp.settings?.allowedVersion ?? "1.0.0",
        maxUsers: insertApp.settings?.maxUsers ?? 1000,
        enableWebhooks: insertApp.settings?.enableWebhooks ?? false,
      },
      messages: {
        loginSuccess: insertApp.messages?.loginSuccess ?? "Login successful",
        loginFailed: insertApp.messages?.loginFailed ?? "Login failed",
        userBanned: insertApp.messages?.userBanned ?? "User banned",
        userExpired: insertApp.messages?.userExpired ?? "User expired",
        versionOutdated: insertApp.messages?.versionOutdated ?? "Version outdated",
        hwidMismatch: insertApp.messages?.hwidMismatch ?? "HWID mismatch",
      },
      hwidLockEnabled: insertApp.settings?.requireHwid ?? false,
      createdAt: now,
      updatedAt: now
    };

    this.applications.set(id, app);
    return app;
  }

  async updateApplication(id: number, updates: UpdateApplication): Promise<Application | undefined> {
    const existingApp = this.applications.get(id);
    if (!existingApp) return undefined;

    const updatedApp: Application = {
      ...existingApp,
      ...updates,
      settings: {
        requireHwid: updates.settings?.requireHwid ?? existingApp.settings.requireHwid,
        requireVersion: updates.settings?.requireVersion ?? existingApp.settings.requireVersion,
        allowedVersion: updates.settings?.allowedVersion ?? existingApp.settings.allowedVersion,
        maxUsers: updates.settings?.maxUsers ?? existingApp.settings.maxUsers,
        enableWebhooks: updates.settings?.enableWebhooks ?? existingApp.settings.enableWebhooks,
      },
      messages: {
        loginSuccess: updates.messages?.loginSuccess ?? existingApp.messages.loginSuccess,
        loginFailed: updates.messages?.loginFailed ?? existingApp.messages.loginFailed,
        userBanned: updates.messages?.userBanned ?? existingApp.messages.userBanned,
        userExpired: updates.messages?.userExpired ?? existingApp.messages.userExpired,
        versionOutdated: updates.messages?.versionOutdated ?? existingApp.messages.versionOutdated,
        hwidMismatch: updates.messages?.hwidMismatch ?? existingApp.messages.hwidMismatch,
      },
      updatedAt: new Date()
    };

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
    const id = this.nextId++;
    const now = new Date();

    const licenseKey: LicenseKey = {
      id,
      applicationId,
      key: license.key,
      maxUsers: license.maxUsers || 10,
      currentUsers: 0,
      expiresAt: license.expiresAt ? new Date(license.expiresAt) : undefined,
      isActive: license.isActive !== undefined ? license.isActive : true,
      createdAt: now,
      updatedAt: now
    };

    this.licenseKeys.set(id, licenseKey);
    return licenseKey;
  }

  async getLicenseKey(id: number): Promise<LicenseKey | undefined> {
    return this.licenseKeys.get(id);
  }

  async getLicenseKeyByKey(key: string): Promise<LicenseKey | undefined> {
    for (const license of this.licenseKeys.values()) {
      if (license.key === key) {
        return license;
      }
    }
    return undefined;
  }

  async getAllLicenseKeys(applicationId: number): Promise<LicenseKey[]> {
    return Array.from(this.licenseKeys.values()).filter(key => key.applicationId === applicationId);
  }

  async updateLicenseKey(id: number, updates: Partial<InsertLicenseKey>): Promise<LicenseKey | undefined> {
    const existingKey = this.licenseKeys.get(id);
    if (!existingKey) return undefined;

    const updatedKey = {
      ...existingKey,
      ...updates,
      updatedAt: new Date()
    };

    this.licenseKeys.set(id, updatedKey);
    return updatedKey;
  }

  async deleteLicenseKey(id: number): Promise<boolean> {
    return this.licenseKeys.delete(id);
  }

  async validateLicenseKey(licenseKey: string, applicationId: number): Promise<LicenseKey | null> {
    const license = await this.getLicenseKeyByKey(licenseKey);
    if (!license || license.applicationId !== applicationId || !license.isActive) {
      return null;
    }

    // Check if license has expired
    if (license.expiresAt && new Date() > license.expiresAt) {
      return null;
    }

    // Check if license has reached max users
    if (license.currentUsers >= license.maxUsers) {
      return null;
    }

    return license;
  }

  async incrementLicenseUsage(licenseKeyId: number): Promise<boolean> {
    const license = this.licenseKeys.get(licenseKeyId);
    if (!license) return false;

    license.currentUsers++;
    license.updatedAt = new Date();
    return true;
  }

  async decrementLicenseUsage(licenseKeyId: number): Promise<boolean> {
    const license = this.licenseKeys.get(licenseKeyId);
    if (!license) return false;

    license.currentUsers = Math.max(0, license.currentUsers - 1);
    license.updatedAt = new Date();
    return true;
  }

  // App User methods
  async getAppUser(id: number): Promise<AppUser | undefined> {
    return this.appUsers.get(id);
  }

  async getAppUserByUsername(applicationId: number, username: string): Promise<AppUser | undefined> {
    for (const user of this.appUsers.values()) {
      if (user.applicationId === applicationId && user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async getAppUserByEmail(applicationId: number, email: string): Promise<AppUser | undefined> {
    if (!email) return undefined;
    for (const user of this.appUsers.values()) {
      if (user.applicationId === applicationId && user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  async createAppUser(applicationId: number, insertUser: InsertAppUser): Promise<AppUser> {
    const id = this.nextId++;
    const hashedPassword = await this.hashPassword(insertUser.password);
    const now = new Date();

    const user: AppUser = {
      id,
      applicationId,
      username: insertUser.username,
      email: insertUser.email,
      password: hashedPassword,
      hwid: insertUser.hwid,
      ipAddress: insertUser.ipAddress,
      userAgent: insertUser.userAgent,
      location: insertUser.location,
      role: insertUser.role || 'user',
      permissions: insertUser.permissions || [],
      isActive: insertUser.isActive !== undefined ? insertUser.isActive : true,
      isPaused: insertUser.isPaused || false,
      expiresAt: insertUser.expiresAt,
      licenseKeyId: insertUser.licenseKeyId,
      lastLogin: undefined,
      loginAttempts: 0,
      createdAt: now,
      updatedAt: now
    };

    this.appUsers.set(id, user);
    return user;
  }

  async createAppUserWithLicense(applicationId: number, insertUser: InsertAppUser): Promise<AppUser> {
    // Validate license key first
    const licenseKey = await this.validateLicenseKey(insertUser.licenseKey!, applicationId);
    if (!licenseKey) {
      throw new Error("Invalid or expired license key");
    }

    const id = this.nextId++;
    const hashedPassword = await this.hashPassword(insertUser.password);
    const now = new Date();

    const user: AppUser = {
      id,
      applicationId,
      username: insertUser.username,
      email: insertUser.email,
      password: hashedPassword,
      hwid: insertUser.hwid,
      ipAddress: insertUser.ipAddress,
      userAgent: insertUser.userAgent,
      location: insertUser.location,
      role: insertUser.role || 'user',
      permissions: insertUser.permissions || [],
      isActive: insertUser.isActive !== undefined ? insertUser.isActive : true,
      isPaused: insertUser.isPaused || false,
      expiresAt: licenseKey.expiresAt,
      licenseKeyId: licenseKey.id,
      lastLogin: undefined,
      loginAttempts: 0,
      createdAt: now,
      updatedAt: now
    };

    this.appUsers.set(id, user);
    await this.incrementLicenseUsage(licenseKey.id);
    
    return user;
  }

  async updateAppUser(id: number, updates: UpdateAppUser): Promise<AppUser | undefined> {
    const existingUser = this.appUsers.get(id);
    if (!existingUser) return undefined;

    const processedUpdates: any = { ...updates };
    
    // Hash password if being updated
    if (processedUpdates.password) {
      processedUpdates.password = await this.hashPassword(processedUpdates.password);
    }

    // Handle date conversion
    if (processedUpdates.expiresAt && typeof processedUpdates.expiresAt === 'string') {
      processedUpdates.expiresAt = new Date(processedUpdates.expiresAt);
    }

    const updatedUser = {
      ...existingUser,
      ...processedUpdates,
      updatedAt: new Date()
    };

    this.appUsers.set(id, updatedUser);
    return updatedUser;
  }

  async deleteAppUser(id: number): Promise<boolean> {
    return this.appUsers.delete(id);
  }

  async pauseAppUser(id: number): Promise<boolean> {
    const user = this.appUsers.get(id);
    if (!user) return false;

    user.isPaused = true;
    user.updatedAt = new Date();
    return true;
  }

  async unpauseAppUser(id: number): Promise<boolean> {
    const user = this.appUsers.get(id);
    if (!user) return false;

    user.isPaused = false;
    user.updatedAt = new Date();
    return true;
  }

  async resetAppUserHwid(id: number): Promise<boolean> {
    const user = this.appUsers.get(id);
    if (!user) return false;

    user.hwid = undefined;
    user.updatedAt = new Date();
    return true;
  }

  async setAppUserHwid(id: number, hwid: string): Promise<boolean> {
    const user = this.appUsers.get(id);
    if (!user) return false;

    user.hwid = hwid;
    user.updatedAt = new Date();
    return true;
  }

  async getAllAppUsers(applicationId: number): Promise<AppUser[]> {
    return Array.from(this.appUsers.values()).filter(user => user.applicationId === applicationId);
  }

  // Webhook methods
  async createWebhook(userId: string, webhook: InsertWebhook): Promise<Webhook> {
    const id = this.nextId++;
    const now = new Date();

    const newWebhook: Webhook = {
      id,
      userId,
      applicationId: webhook.applicationId,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events || [],
      isActive: webhook.isActive !== undefined ? webhook.isActive : true,
      createdAt: now,
      updatedAt: now
    };

    this.webhooks.set(id, newWebhook);
    return newWebhook;
  }

  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    return Array.from(this.webhooks.values()).filter(webhook => webhook.userId === userId);
  }

  async updateWebhook(id: number, updates: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const existingWebhook = this.webhooks.get(id);
    if (!existingWebhook) return undefined;

    const updatedWebhook = {
      ...existingWebhook,
      ...updates,
      updatedAt: new Date()
    };

    this.webhooks.set(id, updatedWebhook);
    return updatedWebhook;
  }

  async deleteWebhook(id: number): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  // Blacklist methods
  async createBlacklistEntry(entry: InsertBlacklistEntry): Promise<BlacklistEntry> {
    const id = this.nextId++;
    const now = new Date();

    const newEntry: BlacklistEntry = {
      id,
      applicationId: entry.applicationId,
      type: entry.type,
      value: entry.value,
      reason: entry.reason,
      createdAt: now
    };

    this.blacklist.set(id, newEntry);
    return newEntry;
  }

  async getBlacklistEntries(applicationId?: number): Promise<BlacklistEntry[]> {
    const entries = Array.from(this.blacklist.values());
    if (applicationId) {
      return entries.filter(entry => entry.applicationId === applicationId);
    }
    return entries;
  }

  async checkBlacklist(applicationId: number, type: string, value: string): Promise<BlacklistEntry | undefined> {
    for (const entry of this.blacklist.values()) {
      if (entry.applicationId === applicationId && entry.type === type && entry.value === value) {
        return entry;
      }
    }
    return undefined;
  }

  async deleteBlacklistEntry(id: number): Promise<boolean> {
    return this.blacklist.delete(id);
  }

  // Activity logging methods
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = this.nextId++;
    const now = new Date();

    const newLog: ActivityLog = {
      id,
      applicationId: log.applicationId,
      appUserId: log.appUserId,
      event: log.event,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      location: log.location,
      metadata: log.metadata,
      createdAt: now
    };

    this.activityLogs.set(id, newLog);
    return newLog;
  }

  async getActivityLogs(applicationId: number, limit: number = 100): Promise<ActivityLog[]> {
    const logs = Array.from(this.activityLogs.values())
      .filter(log => log.applicationId === applicationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return logs;
  }

  async getUserActivityLogs(appUserId: number, limit: number = 100): Promise<ActivityLog[]> {
    const logs = Array.from(this.activityLogs.values())
      .filter(log => log.appUserId === appUserId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return logs;
  }

  // Session tracking methods
  async createActiveSession(session: Omit<ActiveSession, 'id' | 'createdAt' | 'lastActivity'>): Promise<ActiveSession> {
    const id = this.nextId++;
    const now = new Date();

    const newSession: ActiveSession = {
      id,
      ...session,
      createdAt: now,
      lastActivity: now
    };

    this.activeSessions.set(id, newSession);
    return newSession;
  }

  async getActiveSessions(applicationId: number): Promise<ActiveSession[]> {
    return Array.from(this.activeSessions.values()).filter(session => session.applicationId === applicationId);
  }

  async updateSessionActivity(sessionToken: string): Promise<boolean> {
    for (const session of this.activeSessions.values()) {
      if (session.sessionToken === sessionToken) {
        session.lastActivity = new Date();
        return true;
      }
    }
    return false;
  }

  async endSession(sessionToken: string): Promise<boolean> {
    for (const [id, session] of this.activeSessions.entries()) {
      if (session.sessionToken === sessionToken) {
        this.activeSessions.delete(id);
        return true;
      }
    }
    return false;
  }

  // Auth methods
  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }
}

// Export the storage instance
export const storage = new MemStorage();