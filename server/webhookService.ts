import crypto from 'crypto';
import { storage } from './storage.js';
import type { Webhook, ActivityLog } from '../shared/schema.js';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  application_id: number;
  user_data?: {
    id: number;
    username: string;
    email?: string;
    hwid?: string;
    ip_address?: string;
    user_agent?: string;
    location?: string;
  };
  metadata?: any;
  success: boolean;
  error_message?: string;
}

export class WebhookService {
  private static instance: WebhookService;
  
  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private formatDiscordWebhook(payload: WebhookPayload): any {
    const color = payload.success ? 0x00ff00 : 0xff0000; // Green for success, red for failure
    const eventEmoji: Record<string, string> = {
      'user_login': '🔐',
      'login_failed': '❌',
      'user_register': '👤',
      'user_logout': '👋',
      'session_expired': '⏰',
      'hwid_mismatch': '🔒',
      'version_mismatch': '🔄',
      'account_disabled': '🚫',
      'account_expired': '📅'
    };

    return {
      embeds: [{
        title: `${eventEmoji[payload.event] || '📋'} ${payload.event.replace('_', ' ').toUpperCase()}`,
        description: `Application ID: ${payload.application_id}`,
        color: color,
        fields: [
          ...(payload.user_data ? [{
            name: 'User Info',
            value: `**Username:** ${payload.user_data.username}\n**Email:** ${payload.user_data.email || 'N/A'}\n**IP:** ${payload.user_data.ip_address || 'N/A'}`,
            inline: true
          }] : []),
          ...(payload.user_data?.hwid ? [{
            name: 'Hardware ID',
            value: `\`${payload.user_data.hwid}\``,
            inline: true
          }] : []),
          ...(payload.error_message ? [{
            name: 'Error',
            value: payload.error_message,
            inline: false
          }] : []),
          ...(payload.metadata ? [{
            name: 'Additional Info',
            value: JSON.stringify(payload.metadata, null, 2),
            inline: false
          }] : [])
        ],
        timestamp: payload.timestamp,
        footer: {
          text: `NexxAuth • ${payload.success ? 'Success' : 'Failed'}`
        }
      }]
    };
  }

  private formatSlackWebhook(payload: WebhookPayload): any {
    const color = payload.success ? 'good' : 'danger';
    const eventEmoji: Record<string, string> = {
      'user_login': ':lock:',
      'login_failed': ':x:',
      'user_register': ':bust_in_silhouette:',
      'user_logout': ':wave:',
      'session_expired': ':alarm_clock:',
      'hwid_mismatch': ':locked:',
      'version_mismatch': ':arrows_counterclockwise:',
      'account_disabled': ':no_entry_sign:',
      'account_expired': ':calendar:'
    };

    return {
      attachments: [{
        color: color,
        title: `${eventEmoji[payload.event] || ':clipboard:'} ${payload.event.replace('_', ' ').toUpperCase()}`,
        fields: [
          {
            title: 'Application ID',
            value: payload.application_id.toString(),
            short: true
          },
          ...(payload.user_data ? [{
            title: 'Username',
            value: payload.user_data.username,
            short: true
          }] : []),
          ...(payload.user_data?.email ? [{
            title: 'Email',
            value: payload.user_data.email,
            short: true
          }] : []),
          ...(payload.user_data?.ip_address ? [{
            title: 'IP Address',
            value: payload.user_data.ip_address,
            short: true
          }] : []),
          ...(payload.error_message ? [{
            title: 'Error',
            value: payload.error_message,
            short: false
          }] : [])
        ],
        timestamp: Math.floor(new Date(payload.timestamp).getTime() / 1000),
        footer: 'NexxAuth'
      }]
    };
  }

  async sendWebhook(webhook: Webhook, payload: WebhookPayload): Promise<boolean> {
    try {
      const payloadString = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'NexxAuth-Webhook/1.0'
      };

      // Add signature if secret is provided
      if (webhook.secret) {
        headers['X-Webhook-Signature'] = `sha256=${this.generateSignature(payloadString, webhook.secret)}`;
      }

      let body: string;
      
      // Format payload based on webhook URL
      if (webhook.url.includes('discord.com') || webhook.url.includes('discordapp.com')) {
        body = JSON.stringify(this.formatDiscordWebhook(payload));
      } else if (webhook.url.includes('slack.com')) {
        body = JSON.stringify(this.formatSlackWebhook(payload));
      } else {
        body = payloadString;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body
      });

      if (!response.ok) {
        console.error(`Webhook failed: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Webhook error:', error);
      return false;
    }
  }

  async logAndNotify(
    userId: string,
    applicationId: number,
    event: string,
    userData?: any,
    options?: {
      success?: boolean;
      errorMessage?: string;
      metadata?: any;
    }
  ): Promise<void> {
    const success = options?.success ?? true;
    const errorMessage = options?.errorMessage;
    const metadata = options?.metadata;

    // Create activity log
    try {
      await storage.createActivityLog({
        applicationId,
        appUserId: userData?.id,
        event,
        ipAddress: userData?.ip_address,
        hwid: userData?.hwid,
        userAgent: userData?.user_agent,
        metadata,
        success,
        errorMessage
      });
    } catch (error) {
      console.error('Failed to create activity log:', error);
    }

    // Send webhook notifications
    try {
      const webhooks = await storage.getUserWebhooks(userId);
      const activeWebhooks = webhooks.filter(w => w.isActive && w.events.includes(event));

      if (activeWebhooks.length === 0) {
        return;
      }

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        application_id: applicationId,
        user_data: userData ? {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          hwid: userData.hwid,
          ip_address: userData.ip_address,
          user_agent: userData.user_agent,
          location: userData.location
        } : undefined,
        metadata,
        success,
        error_message: errorMessage
      };

      // Send to all active webhooks
      const webhookPromises = activeWebhooks.map(webhook => 
        this.sendWebhook(webhook, payload)
      );

      await Promise.all(webhookPromises);
    } catch (error) {
      console.error('Failed to send webhook notifications:', error);
    }
  }
}

export const webhookService = WebhookService.getInstance();