/**
 * Evento Canónico Normalizado de Webhooks — Zaza Click 2.0
 */

import { EngineType } from './engine.types';

export type WhatsAppEventType =
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_SENT'
  | 'MESSAGE_STATUS_UPDATE'
  | 'CONNECTION_UPDATE'
  | 'QRCODE_UPDATED'
  | 'CHATS_UPDATE'
  | 'MESSAGES_UPDATE'
  | 'CONTACTS_UPDATE'
  | 'PRESENCE_UPDATE'
  | 'ERROR';

export interface WhatsAppEvent {
  eventId: string;
  engine: EngineType;
  instanceName: string;
  type: WhatsAppEventType;
  timestamp: number;
  data: {
    messageId?: string;
    from?: string;
    to?: string;
    remoteJid?: string;
    body?: string;
    mediaUrl?: string;
    mediaType?: string;
    status?: string;
    connectionState?: string;
    qrcodeBase64?: string;
    pushName?: string;
    unreadCount?: number;
    raw?: any;
  };
}
