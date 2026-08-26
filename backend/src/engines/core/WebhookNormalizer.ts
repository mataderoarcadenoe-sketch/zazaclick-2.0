/**
 * Normalizador Canónico de Eventos de Webhook — Zaza Click 2.0
 */

import { WhatsAppEvent, WhatsAppEventType } from '../contracts/event.types';
import { EngineType } from '../contracts/engine.types';

export class WebhookNormalizer {
  /**
   * Transforma cualquier payload crudo de webhook de Evolution API o Evolution Go a WhatsAppEvent canónico
   */
  public static normalize(rawEvent: string, instanceName: string, data: any, engineType: EngineType = 'evolution_api'): WhatsAppEvent {
    const rawUpper = (rawEvent || '').toUpperCase().replace('.', '_').replace('-', '_');
    const timestamp = data?.messageTimestamp ? data.messageTimestamp * 1000 : Date.now();

    let type: WhatsAppEventType = 'ERROR';
    const normalizedData: any = { raw: data };

    if (rawUpper === 'MESSAGES_UPSERT' || rawUpper === 'MESSAGE_CREATE' || rawUpper === 'MESSAGES_UPSERT') {
      type = 'MESSAGE_RECEIVED';
      const key = data?.key || {};
      normalizedData.messageId = key.id || data?.id;
      normalizedData.from = key.fromMe ? 'me' : key.remoteJid;
      normalizedData.remoteJid = key.remoteJid || data?.remoteJid;
      normalizedData.pushName = data?.pushName || key.pushName;
      normalizedData.body = data?.message?.conversation || data?.message?.extendedTextMessage?.text || data?.text || '';
    } else if (rawUpper === 'CONNECTION_UPDATE' || rawUpper === 'CONNECTION_CHANGED') {
      type = 'CONNECTION_UPDATE';
      const connection = data?.connection || data?.state || (data?.isConnected ? 'open' : 'close');
      normalizedData.connectionState = connection;
      normalizedData.status = connection === 'open' ? 'connected' : 'disconnected';
    } else if (rawUpper === 'QRCODE_UPDATED' || rawUpper === 'QR_CODE') {
      type = 'QRCODE_UPDATED';
      normalizedData.qrcodeBase64 = data?.qrcode?.base64 || data?.base64 || data?.qrcode;
    } else if (rawUpper === 'CHATS_UPDATE' || rawUpper === 'CHAT_UPDATE') {
      type = 'CHATS_UPDATE';
      normalizedData.remoteJid = data?.id || data?.remoteJid;
      normalizedData.unreadCount = data?.unreadCount ?? 0;
    } else if (rawUpper === 'MESSAGES_UPDATE' || rawUpper === 'MESSAGE_UPDATE') {
      type = 'MESSAGES_UPDATE';
      normalizedData.messageId = data?.key?.id || data?.id;
      normalizedData.status = data?.status || data?.update?.status;
    } else if (rawUpper === 'CONTACTS_UPSERT' || rawUpper === 'CONTACTS_UPDATE') {
      type = 'CONTACTS_UPDATE';
    } else if (rawUpper === 'PRESENCE_UPDATE') {
      type = 'PRESENCE_UPDATE';
      normalizedData.remoteJid = data?.id || data?.remoteJid;
    }

    const eventId = `evt_${engineType}_${instanceName}_${normalizedData.messageId || timestamp}_${Math.floor(Math.random() * 1000)}`;

    return {
      eventId,
      engine: engineType,
      instanceName,
      type,
      timestamp,
      data: normalizedData
    };
  }
}
