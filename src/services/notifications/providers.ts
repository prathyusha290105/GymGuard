import { NotificationChannel } from '../../types';

export interface SendMessageOptions {
  recipientId: string;
  recipientContact: string; // email address, phone number
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface ProviderResult {
  success: boolean;
  channel: NotificationChannel;
  providerName: string;
  configured: boolean;
  messageId?: string;
  statusMessage: string;
}

export interface NotificationProvider {
  channel: NotificationChannel;
  name: string;
  isConfigured(): boolean;
  send(options: SendMessageOptions): Promise<ProviderResult>;
}

export class MockEmailProvider implements NotificationProvider {
  channel: NotificationChannel = 'EMAIL';
  name = 'SendGrid / SMTP Email Service';

  isConfigured(): boolean {
    return false; // Clearly shows Provider Not Configured
  }

  async send(options: SendMessageOptions): Promise<ProviderResult> {
    console.log(`[EmailProvider (Mock / Not Configured)] To: ${options.recipientContact} | Subject: ${options.title} | Body: ${options.message}`);
    return {
      success: true,
      channel: 'EMAIL',
      providerName: this.name,
      configured: false,
      messageId: `mock-email-${Date.now()}`,
      statusMessage: 'Provider not configured in production env; dispatched in simulated sandbox mode.'
    };
  }
}

export class MockSmsProvider implements NotificationProvider {
  channel: NotificationChannel = 'SMS';
  name = 'Twilio SMS Gateway';

  isConfigured(): boolean {
    return false;
  }

  async send(options: SendMessageOptions): Promise<ProviderResult> {
    console.log(`[SmsProvider (Mock / Not Configured)] To: ${options.recipientContact} | Body: ${options.message}`);
    return {
      success: true,
      channel: 'SMS',
      providerName: this.name,
      configured: false,
      messageId: `mock-sms-${Date.now()}`,
      statusMessage: 'Provider not configured in production env; logged to test console.'
    };
  }
}

export class MockWhatsAppProvider implements NotificationProvider {
  channel: NotificationChannel = 'WHATSAPP';
  name = 'Meta WhatsApp Cloud Business API';

  isConfigured(): boolean {
    return false;
  }

  async send(options: SendMessageOptions): Promise<ProviderResult> {
    console.log(`[WhatsAppProvider (Mock / Not Configured)] To: ${options.recipientContact} | Body: ${options.message}`);
    return {
      success: true,
      channel: 'WHATSAPP',
      providerName: this.name,
      configured: false,
      messageId: `mock-wa-${Date.now()}`,
      statusMessage: 'Provider not configured in production env; logged to test console.'
    };
  }
}

export const emailProvider = new MockEmailProvider();
export const smsProvider = new MockSmsProvider();
export const whatsAppProvider = new MockWhatsAppProvider();
