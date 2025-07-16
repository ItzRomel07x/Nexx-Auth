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
  
  // App User methods
  createAppUser(applicationId: number, user: InsertAppUser): Promise<AppUser>;
  getAppUser(id: number): Promise<AppUser | undefined>;
  getAppUserByUsername(applicationId: number, username: string): Promise<AppUser | undefined>;
  getAllAppUsers(applicationId: number): Promise<AppUser[]>;
  updateAppUser(id: number, updates: UpdateAppUser): Promise<AppUser | undefined>;
  deleteAppUser(id: number): Promise<boolean>;
  
  // Auth related methods
  validateLogin(applicationId: number, username: string, password: string): Promise<AppUser | null>;
  
  // Webhook methods
  createWebhook(userId: string, webhook: InsertWebhook): Promise<Webhook>;
  getWebhook(id: number): Promise<Webhook | undefined>;
  getAllWebhooks(userId: string, applicationId?: number): Promise<Webhook[]>;
  updateWebhook(id: number, updates: Partial<InsertWebhook>): Promise<Webhook | undefined>;
  deleteWebhook(id: number): Promise<boolean>;
  
  // Blacklist methods
  createBlacklistEntry(entry: InsertBlacklistEntry): Promise<BlacklistEntry>;
  getBlacklistEntry(id: number): Promise<BlacklistEntry | undefined>;
  getAllBlacklistEntries(applicationId: number): Promise<BlacklistEntry[]>;
  deleteBlacklistEntry(id: number): Promise<boolean>;
  isBlacklisted(applicationId: number, type: string, value: string): Promise<boolean>;
  
  // Activity log methods
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(applicationId: number, limit?: number): Promise<ActivityLog[]>;
  
  // Active session methods
  createActiveSession(session: Omit<ActiveSession, "id" | "createdAt" | "lastActivity">): Promise<ActiveSession>;
  getActiveSession(sessionToken: string): Promise<ActiveSession | undefined>;
  getAllActiveSessions(applicationId: number): Promise<ActiveSession[]>;
  updateActiveSession(sessionToken: string, updates: Partial<ActiveSession>): Promise<ActiveSession | undefined>;
  deleteActiveSession(sessionToken: string): Promise<boolean>;
  
  // Utility methods
  hashPassword(password: string): Promise<string>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private applications: Map<number, Application> = new Map();
  private licenseKeys: Map<number, LicenseKey> = new Map();
  private appUsers: Map<number, AppUser> = new Map();
  private webhooks: Map<number, Webhook> = new Map();
  private blacklistEntries: Map<number, BlacklistEntry> = new Map();
  private activityLogs: Map<number, ActivityLog> = new Map();
  private activeSessions: Map<string, ActiveSession> = new Map();
  
  private nextId = 1;
  
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
  
  async upsertUser(user: UpsertUser): Promise<User> {
    const existingUser = this.users.get(user.id);
    const now = new Date();
    
    const newUser: User = {
      ...user,
      role: user.role || "user",
      permissions: user.permissions || [],
      isActive: user.isActive ?? true,
      createdAt: existingUser?.createdAt || now,
      updatedAt: now,
    };
    
    this.users.set(user.id, newUser);
    return newUser;
  }
  
  async getApplication(id: number): Promise<Application | undefined> {
    return this.applications.get(id);
  }
  
  async getApplicationByApiKey(apiKey: string): Promise<Application | undefined> {
    return Array.from(this.applications.values()).find(app => app.apiKey === apiKey);
  }
  
  async createApplication(userId: string, app: InsertApplication): Promise<Application> {
    const id = this.nextId++;
    const now = new Date();
    
    const newApp: Application = {
      id,
      userId,
      name: app.name,
      description: app.description,
      apiKey: nanoid(32),
      isActive: true,
      settings: {
        requireHwid: app.settings?.requireHwid || false,
        requireVersion: app.settings?.requireVersion || false,
        allowedVersion: app.settings?.allowedVersion || "",
        maxUsers: app.settings?.maxUsers || 100,
        enableWebhooks: app.settings?.enableWebhooks || false,
      },
      messages: {
        loginSuccess: app.messages?.loginSuccess || "Login successful!",
        loginFailed: app.messages?.loginFailed || "Invalid credentials!",
        userBanned: app.messages?.userBanned || "Account is disabled!",
        userExpired: app.messages?.userExpired || "Account has expired!",
        versionOutdated: app.messages?.versionOutdated || "Please update your application!",
        hwidMismatch: app.messages?.hwidMismatch || "Hardware ID mismatch detected!",
      },
      createdAt: now,
      updatedAt: now,
    };
    
    this.applications.set(id, newApp);
    return newApp;
  }
  
  async updateApplication(id: number, updates: UpdateApplication): Promise<Application | undefined> {
    const app = this.applications.get(id);
    if (!app) return undefined;
    
    const updatedApp: Application = {
      ...app,
      ...updates,
      settings: updates.settings ? { 
        requireHwid: updates.settings.requireHwid ?? app.settings.requireHwid,
        requireVersion: updates.settings.requireVersion ?? app.settings.requireVersion,
        allowedVersion: updates.settings.allowedVersion ?? app.settings.allowedVersion,
        maxUsers: updates.settings.maxUsers ?? app.settings.maxUsers,
        enableWebhooks: updates.settings.enableWebhooks ?? app.settings.enableWebhooks,
      } : app.settings,
      messages: updates.messages ? { 
        loginSuccess: updates.messages.loginSuccess ?? app.messages.loginSuccess,
        loginFailed: updates.messages.loginFailed ?? app.messages.loginFailed,
        userBanned: updates.messages.userBanned ?? app.messages.userBanned,
        userExpired: updates.messages.userExpired ?? app.messages.userExpired,
        versionOutdated: updates.messages.versionOutdated ?? app.messages.versionOutdated,
        hwidMismatch: updates.messages.hwidMismatch ?? app.messages.hwidMismatch,
      } : app.messages,
      updatedAt: new Date(),
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
  
  async createLicenseKey(applicationId: number, license: InsertLicenseKey): Promise<LicenseKey> {
    const id = this.nextId++;
    const now = new Date();
    
    const newLicense: LicenseKey = {
      id,
      applicationId,
      key: license.key,
      maxUsers: license.maxUsers ?? 1,
      currentUsers: 0,
      expiresAt: license.expiresAt ? new Date(license.expiresAt) : undefined,
      isActive: license.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    
    this.licenseKeys.set(id, newLicense);
    return newLicense;
  }
  
  async getLicenseKey(id: number): Promise<LicenseKey | undefined> {
    return this.licenseKeys.get(id);
  }
  
  async getLicenseKeyByKey(licenseKey: string): Promise<LicenseKey | undefined> {
    return Array.from(this.licenseKeys.values()).find(key => key.key === licenseKey);
  }
  
  async getAllLicenseKeys(applicationId: number): Promise<LicenseKey[]> {
    return Array.from(this.licenseKeys.values()).filter(key => key.applicationId === applicationId);
  }
  
  async updateLicenseKey(id: number, updates: Partial<InsertLicenseKey>): Promise<LicenseKey | undefined> {
    const license = this.licenseKeys.get(id);
    if (!license) return undefined;
    
    const updatedLicense: LicenseKey = {
      ...license,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.licenseKeys.set(id, updatedLicense);
    return updatedLicense;
  }
  
  async deleteLicenseKey(id: number): Promise<boolean> {
    return this.licenseKeys.delete(id);
  }
  
  async createAppUser(applicationId: number, user: InsertAppUser): Promise<AppUser> {
    const id = this.nextId++;
    const now = new Date();
    
    const newUser: AppUser = {
      id,
      applicationId,
      username: user.username,
      email: user.email,
      password: await this.hashPassword(user.password),
      hwid: user.hwid,
      ipAddress: user.ipAddress,
      userAgent: user.userAgent,
      location: user.location,
      role: user.role || "user",
      permissions: user.permissions || [],
      isActive: user.isActive ?? true,
      isPaused: user.isPaused ?? false,
      expiresAt: user.expiresAt ? new Date(user.expiresAt) : undefined,
      licenseKeyId: user.licenseKeyId,
      createdAt: now,
      updatedAt: now,
    };
    
    this.appUsers.set(id, newUser);
    return newUser;
  }
  
  async getAppUser(id: number): Promise<AppUser | undefined> {
    return this.appUsers.get(id);
  }
  
  async getAppUserByUsername(applicationId: number, username: string): Promise<AppUser | undefined> {
    return Array.from(this.appUsers.values()).find(user => 
      user.applicationId === applicationId && user.username === username
    );
  }
  
  async getAllAppUsers(applicationId: number): Promise<AppUser[]> {
    return Array.from(this.appUsers.values()).filter(user => user.applicationId === applicationId);
  }
  
  async updateAppUser(id: number, updates: UpdateAppUser): Promise<AppUser | undefined> {
    const user = this.appUsers.get(id);
    if (!user) return undefined;
    
    const updatedUser: AppUser = {
      ...user,
      ...updates,
      password: updates.password ? await this.hashPassword(updates.password) : user.password,
      updatedAt: new Date(),
    };
    
    this.appUsers.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteAppUser(id: number): Promise<boolean> {
    return this.appUsers.delete(id);
  }
  
  async validateLogin(applicationId: number, username: string, password: string): Promise<AppUser | null> {
    const user = await this.getAppUserByUsername(applicationId, username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    // Update last login
    user.lastLogin = new Date();
    this.appUsers.set(user.id, user);
    
    return user;
  }
  
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
      isActive: webhook.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    
    this.webhooks.set(id, newWebhook);
    return newWebhook;
  }
  
  async getWebhook(id: number): Promise<Webhook | undefined> {
    return this.webhooks.get(id);
  }
  
  async getAllWebhooks(userId: string, applicationId?: number): Promise<Webhook[]> {
    const userWebhooks = Array.from(this.webhooks.values()).filter(webhook => webhook.userId === userId);
    
    if (applicationId) {
      return userWebhooks.filter(webhook => webhook.applicationId === applicationId);
    }
    
    return userWebhooks;
  }
  
  async updateWebhook(id: number, updates: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return undefined;
    
    const updatedWebhook: Webhook = {
      ...webhook,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.webhooks.set(id, updatedWebhook);
    return updatedWebhook;
  }
  
  async deleteWebhook(id: number): Promise<boolean> {
    return this.webhooks.delete(id);
  }
  
  async createBlacklistEntry(entry: InsertBlacklistEntry): Promise<BlacklistEntry> {
    const id = this.nextId++;
    const now = new Date();
    
    const newEntry: BlacklistEntry = {
      id,
      applicationId: entry.applicationId,
      type: entry.type,
      value: entry.value,
      reason: entry.reason,
      createdAt: now,
    };
    
    this.blacklistEntries.set(id, newEntry);
    return newEntry;
  }
  
  async getBlacklistEntry(id: number): Promise<BlacklistEntry | undefined> {
    return this.blacklistEntries.get(id);
  }
  
  async getAllBlacklistEntries(applicationId: number): Promise<BlacklistEntry[]> {
    return Array.from(this.blacklistEntries.values()).filter(entry => entry.applicationId === applicationId);
  }
  
  async deleteBlacklistEntry(id: number): Promise<boolean> {
    return this.blacklistEntries.delete(id);
  }
  
  async isBlacklisted(applicationId: number, type: string, value: string): Promise<boolean> {
    return Array.from(this.blacklistEntries.values()).some(entry => 
      entry.applicationId === applicationId && entry.type === type && entry.value === value
    );
  }
  
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
      createdAt: now,
    };
    
    this.activityLogs.set(id, newLog);
    return newLog;
  }
  
  async getActivityLogs(applicationId: number, limit?: number): Promise<ActivityLog[]> {
    const logs = Array.from(this.activityLogs.values())
      .filter(log => log.applicationId === applicationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return limit ? logs.slice(0, limit) : logs;
  }
  
  async createActiveSession(session: Omit<ActiveSession, "id" | "createdAt" | "lastActivity">): Promise<ActiveSession> {
    const id = this.nextId++;
    const now = new Date();
    
    const newSession: ActiveSession = {
      id,
      ...session,
      createdAt: now,
      lastActivity: now,
    };
    
    this.activeSessions.set(session.sessionToken, newSession);
    return newSession;
  }
  
  async getActiveSession(sessionToken: string): Promise<ActiveSession | undefined> {
    return this.activeSessions.get(sessionToken);
  }
  
  async getAllActiveSessions(applicationId: number): Promise<ActiveSession[]> {
    return Array.from(this.activeSessions.values()).filter(session => session.applicationId === applicationId);
  }
  
  async updateActiveSession(sessionToken: string, updates: Partial<ActiveSession>): Promise<ActiveSession | undefined> {
    const session = this.activeSessions.get(sessionToken);
    if (!session) return undefined;
    
    const updatedSession: ActiveSession = {
      ...session,
      ...updates,
      lastActivity: new Date(),
    };
    
    this.activeSessions.set(sessionToken, updatedSession);
    return updatedSession;
  }
  
  async deleteActiveSession(sessionToken: string): Promise<boolean> {
    return this.activeSessions.delete(sessionToken);
  }
  
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }
}

// Use in-memory storage - clean and simple for Vercel deployment
export const storage = new MemStorage();