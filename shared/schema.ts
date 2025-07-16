import { z } from "zod";

// TypeScript types for the authentication system
export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface Application {
  id: number;
  userId: string;
  name: string;
  description?: string;
  apiKey: string;
  isActive: boolean;
  settings: {
    requireHwid: boolean;
    requireVersion: boolean;
    allowedVersion: string;
    maxUsers: number;
    enableWebhooks: boolean;
  };
  messages: {
    loginSuccess: string;
    loginFailed: string;
    userBanned: string;
    userExpired: string;
    versionOutdated: string;
    hwidMismatch: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertApplication {
  name: string;
  description?: string;
  settings?: {
    requireHwid?: boolean;
    requireVersion?: boolean;
    allowedVersion?: string;
    maxUsers?: number;
    enableWebhooks?: boolean;
  };
  messages?: {
    loginSuccess?: string;
    loginFailed?: string;
    userBanned?: string;
    userExpired?: string;
    versionOutdated?: string;
    hwidMismatch?: string;
  };
}

export interface UpdateApplication {
  name?: string;
  description?: string;
  isActive?: boolean;
  settings?: {
    requireHwid?: boolean;
    requireVersion?: boolean;
    allowedVersion?: string;
    maxUsers?: number;
    enableWebhooks?: boolean;
  };
  messages?: {
    loginSuccess?: string;
    loginFailed?: string;
    userBanned?: string;
    userExpired?: string;
    versionOutdated?: string;
    hwidMismatch?: string;
  };
}

export interface AppUser {
  id: number;
  applicationId: number;
  username: string;
  email?: string;
  password: string;
  hwid?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  isPaused: boolean;
  expiresAt?: Date;
  licenseKeyId?: number;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertAppUser {
  username: string;
  email?: string;
  password: string;
  hwid?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
  isPaused?: boolean;
  expiresAt?: Date;
  licenseKeyId?: number;
  licenseKey?: string;
}

export interface UpdateAppUser {
  username?: string;
  email?: string;
  password?: string;
  hwid?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
  isPaused?: boolean;
  expiresAt?: Date;
  licenseKeyId?: number;
}

export interface LicenseKey {
  id: number;
  applicationId: number;
  key: string;
  maxUsers: number;
  currentUsers: number;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertLicenseKey {
  key: string;
  maxUsers?: number;
  expiresAt?: Date;
  isActive?: boolean;
}

export interface Webhook {
  id: number;
  userId: string;
  applicationId: number;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertWebhook {
  applicationId: number;
  name: string;
  url: string;
  secret?: string;
  events?: string[];
  isActive?: boolean;
}

export interface BlacklistEntry {
  id: number;
  applicationId: number;
  type: string;
  value: string;
  reason?: string;
  createdAt: Date;
}

export interface InsertBlacklistEntry {
  applicationId: number;
  type: string;
  value: string;
  reason?: string;
}

export interface ActivityLog {
  id: number;
  applicationId: number;
  appUserId?: number;
  event: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  metadata?: any;
  createdAt: Date;
}

export interface InsertActivityLog {
  applicationId: number;
  appUserId?: number;
  event: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  metadata?: any;
}

export interface ActiveSession {
  id: number;
  applicationId: number;
  appUserId: number;
  sessionToken: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  createdAt: Date;
  lastActivity: Date;
}

// Zod schemas for validation
export const insertApplicationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  settings: z.object({
    requireHwid: z.boolean().optional(),
    requireVersion: z.boolean().optional(),
    allowedVersion: z.string().optional(),
    maxUsers: z.number().min(1).optional(),
    enableWebhooks: z.boolean().optional(),
  }).optional(),
  messages: z.object({
    loginSuccess: z.string().optional(),
    loginFailed: z.string().optional(),
    userBanned: z.string().optional(),
    userExpired: z.string().optional(),
    versionOutdated: z.string().optional(),
    hwidMismatch: z.string().optional(),
  }).optional(),
});

export const updateApplicationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  settings: z.object({
    requireHwid: z.boolean().optional(),
    requireVersion: z.boolean().optional(),
    allowedVersion: z.string().optional(),
    maxUsers: z.number().min(1).optional(),
    enableWebhooks: z.boolean().optional(),
  }).optional(),
  messages: z.object({
    loginSuccess: z.string().optional(),
    loginFailed: z.string().optional(),
    userBanned: z.string().optional(),
    userExpired: z.string().optional(),
    versionOutdated: z.string().optional(),
    hwidMismatch: z.string().optional(),
  }).optional(),
});

export const insertAppUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  hwid: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  location: z.string().optional(),
  role: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  expiresAt: z.string().optional(),
  licenseKeyId: z.number().optional(),
  licenseKey: z.string().optional(),
});

export const updateAppUserSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  hwid: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  location: z.string().optional(),
  role: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  expiresAt: z.string().optional(),
  licenseKeyId: z.number().optional(),
});

export const insertLicenseKeySchema = z.object({
  key: z.string().min(1, "License key is required"),
  maxUsers: z.number().min(1).optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  hwid: z.string().optional(),
  version: z.string().optional(),
  licenseKey: z.string().optional(),
});

export const insertWebhookSchema = z.object({
  applicationId: z.number().min(1, "Application ID is required"),
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const insertBlacklistSchema = z.object({
  applicationId: z.number().min(1, "Application ID is required"),
  type: z.enum(["ip", "username", "email", "hwid"], {
    errorMap: () => ({ message: "Type must be one of: ip, username, email, hwid" }),
  }),
  value: z.string().min(1, "Value is required"),
  reason: z.string().optional(),
});