/**
 * Interfaz Canónica del Motor de WhatsApp — Zaza Click 2.0
 */

import { EngineType, EngineCapabilities, EngineResult, EngineHealth } from './engine.types';
import {
  SendTextMessageParams,
  SendMediaMessageParams,
  SendAudioMessageParams,
  SendLocationMessageParams,
  SendContactMessageParams
} from './message.types';

export interface WhatsAppEngine {
  readonly engineType: EngineType;
  readonly capabilities: EngineCapabilities;

  // Ciclo de vida y conexión de instancias
  createInstance(instanceName: string): Promise<EngineResult<{ token: string; qrcode?: string; instance?: any }>>;
  deleteInstance(instanceName: string): Promise<EngineResult<boolean>>;
  getConnectionState(instanceName: string): Promise<EngineResult<{ state: string; isConnected: boolean }>>;
  reconnect?(instanceName: string): Promise<EngineResult<{ state: string; isConnected: boolean; requiresQr?: boolean }>>;
  getQRCode(instanceName: string): Promise<EngineResult<{ qrcode: string }>>;
  logout(instanceName: string): Promise<EngineResult<boolean>>;
  configureWebhook(instanceName: string, webhookUrl: string): Promise<EngineResult<boolean>>;

  // Envíos de mensajería unificada
  sendTextMessage(params: SendTextMessageParams): Promise<EngineResult>;
  sendMediaMessage(params: SendMediaMessageParams): Promise<EngineResult>;
  sendAudioMessage(params: SendAudioMessageParams): Promise<EngineResult>;
  sendLocationMessage(params: SendLocationMessageParams): Promise<EngineResult>;
  sendContactMessage(params: SendContactMessageParams): Promise<EngineResult>;

  // Métodos de chat opcionales
  getChats?(instanceName: string): Promise<EngineResult<any[]>>;
  getChatMessages?(instanceName: string, remoteJid: string): Promise<EngineResult<any[]>>;
  getMediaMessageBase64?(instanceName: string, messageKey: any, messageContent: any): Promise<EngineResult<any>>;
  markMessagesAsRead?(instanceName: string, remoteJid: string, messageIds: string[], phoneJid?: string): Promise<EngineResult<boolean>>;

  // Métodos de grupos de WhatsApp
  getGroups?(instanceName: string, getParticipants?: boolean): Promise<EngineResult<any[]>>;
  createGroup?(instanceName: string, subject: string, participants: string[]): Promise<EngineResult<any>>;
  updateGroupParticipants?(instanceName: string, groupJid: string, action: 'add' | 'remove' | 'promote' | 'demote', participants: string[]): Promise<EngineResult<any>>;
  getGroupInviteCode?(instanceName: string, groupJid: string): Promise<EngineResult<any>>;

  // Diagnóstico y salud
  healthCheck(): Promise<EngineHealth>;
}
