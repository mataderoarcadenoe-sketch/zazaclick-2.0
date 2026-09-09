/**
 * Adapter Canónico para Evolution API 2.4.0-rc2 — Zaza Click 2.0
 */

import { WhatsAppEngine } from '../contracts/WhatsAppEngine';
import { EngineType, EngineCapabilities, EngineResult, EngineHealth } from '../contracts/engine.types';
import {
  SendTextMessageParams,
  SendMediaMessageParams,
  SendAudioMessageParams,
  SendLocationMessageParams,
  SendContactMessageParams
} from '../contracts/message.types';
import { CircuitBreaker } from '../core/CircuitBreaker';
import { EvolutionApiMapper } from './EvolutionApiMapper';
import { EvolutionService } from '../../services/evolution.service';

export class EvolutionApiEngine implements WhatsAppEngine {
  public readonly engineType: EngineType = 'evolution_api';
  public readonly capabilities: EngineCapabilities = {
    sendText: true,
    sendMedia: true,
    sendAudio: true,
    sendLocation: true,
    sendContact: true,
    webhooks: true,
    groups: true,
    chatsHistory: true
  };

  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker('evolution_api', {
      failureThreshold: 5,
      cooldownPeriodMs: 30000
    });
  }

  public async createInstance(instanceName: string): Promise<EngineResult<{ token: string; qrcode?: string; instance?: any }>> {
    const start = Date.now();
    try {
      const res = await EvolutionService.createInstance(instanceName);
      const latencyMs = Date.now() - start;

      if (res.success && res.instance) {
        this.circuitBreaker.recordSuccess();
        return EvolutionApiMapper.mapSuccess({
          token: res.instance.token,
          qrcode: res.instance.qrcode?.base64,
          instance: res.instance
        }, latencyMs);
      }

      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Fallo al crear instancia en Evolution API',
          isRetryable: false,
          statusCode: res.status || 500
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async deleteInstance(instanceName: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const success = await EvolutionService.deleteInstance(instanceName);
      const latencyMs = Date.now() - start;
      if (success) {
        this.circuitBreaker.recordSuccess();
        return EvolutionApiMapper.mapSuccess(true, latencyMs);
      }
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_INSTANCE_NOT_FOUND',
          message: 'No se pudo eliminar la instancia en Evolution API',
          isRetryable: false,
          statusCode: 404
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async getConnectionState(instanceName: string): Promise<EngineResult<{ state: string; isConnected: boolean }>> {
    const start = Date.now();
    try {
      const state = await EvolutionService.getConnectionState(instanceName);
      const latencyMs = Date.now() - start;
      const isConnected = state === 'open' || state === 'connected';
      this.circuitBreaker.recordSuccess();
      return EvolutionApiMapper.mapSuccess({ state, isConnected }, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async reconnect(instanceName: string): Promise<EngineResult<{ state: string; isConnected: boolean; requiresQr?: boolean }>> {
    const start = Date.now();
    try {
      const result = await EvolutionService.reconnect(instanceName);
      const latencyMs = Date.now() - start;
      if (result.isConnected) {
        this.circuitBreaker.recordSuccess();
      }
      return EvolutionApiMapper.mapSuccess(result, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async getQRCode(instanceName: string): Promise<EngineResult<{ qrcode: string }>> {
    const start = Date.now();
    try {
      const qrRes = await EvolutionService.getQRCode(instanceName);
      const latencyMs = Date.now() - start;
      if (qrRes.success && qrRes.qrcode) {
        this.circuitBreaker.recordSuccess();
        return EvolutionApiMapper.mapSuccess({ qrcode: qrRes.qrcode }, latencyMs);
      }
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: qrRes.error || 'Error al obtener código QR',
          isRetryable: true,
          statusCode: 500
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async logout(instanceName: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const success = await EvolutionService.logout(instanceName);
      const latencyMs = Date.now() - start;
      if (success) {
        this.circuitBreaker.recordSuccess();
        return EvolutionApiMapper.mapSuccess(true, latencyMs);
      }
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: 'Fallo al cerrar sesión en Evolution API',
          isRetryable: false,
          statusCode: 500
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async configureWebhook(instanceName: string, webhookUrl?: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const success = await EvolutionService.configureWebhook(instanceName);
      const latencyMs = Date.now() - start;
      return EvolutionApiMapper.mapSuccess(success, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendTextMessage(params: SendTextMessageParams): Promise<EngineResult> {
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_UNAVAILABLE',
          message: 'Circuito abierto para Evolution API debido a fallos continuos de red. Intenta más tarde.',
          isRetryable: true,
          statusCode: 503
        }
      };
    }

    const start = Date.now();
    try {
      const res = await EvolutionService.sendTextMessage(params.instanceName, params.number, params.text);
      const latencyMs = Date.now() - start;

      if (res.success) {
        this.circuitBreaker.recordSuccess();
        const msgId = res.data?.key?.id;
        return EvolutionApiMapper.mapSuccess(res.data, latencyMs, msgId);
      }

      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al enviar texto en Evolution API',
          isRetryable: false,
          statusCode: 422,
          details: res.details
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendMediaMessage(params: SendMediaMessageParams): Promise<EngineResult> {
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_UNAVAILABLE',
          message: 'Circuito abierto para Evolution API.',
          isRetryable: true,
          statusCode: 503
        }
      };
    }

    const start = Date.now();
    try {
      const res = await EvolutionService.sendMediaMessage(
        params.instanceName,
        params.number,
        params.media,
        params.mediatype,
        params.mimetype,
        params.caption,
        params.fileName
      );
      const latencyMs = Date.now() - start;

      if (res.success) {
        this.circuitBreaker.recordSuccess();
        const msgId = res.data?.key?.id;
        return EvolutionApiMapper.mapSuccess(res.data, latencyMs, msgId);
      }

      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al enviar media en Evolution API',
          isRetryable: false,
          statusCode: 502,
          details: res.details
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendAudioMessage(params: SendAudioMessageParams): Promise<EngineResult> {
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_UNAVAILABLE',
          message: 'Circuito abierto para Evolution API.',
          isRetryable: true,
          statusCode: 503
        }
      };
    }

    const start = Date.now();
    try {
      const res = await EvolutionService.sendWhatsAppAudio(params.instanceName, params.number, params.audio);
      const latencyMs = Date.now() - start;

      if (res.success) {
        this.circuitBreaker.recordSuccess();
        const msgId = res.data?.key?.id;
        return EvolutionApiMapper.mapSuccess(res.data, latencyMs, msgId);
      }

      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al enviar audio PTT en Evolution API',
          isRetryable: false,
          statusCode: 502,
          details: res.details
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendLocationMessage(params: SendLocationMessageParams): Promise<EngineResult> {
    const start = Date.now();
    try {
      const res = await EvolutionService.sendLocation(
        params.instanceName,
        params.number,
        params.name,
        params.address,
        params.latitude,
        params.longitude
      );
      const latencyMs = Date.now() - start;

      if (res.success) {
        this.circuitBreaker.recordSuccess();
        const msgId = res.data?.key?.id;
        return EvolutionApiMapper.mapSuccess(res.data, latencyMs, msgId);
      }

      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al enviar ubicación en Evolution API',
          isRetryable: false,
          statusCode: 502,
          details: res.details
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendContactMessage(params: SendContactMessageParams): Promise<EngineResult> {
    const start = Date.now();
    try {
      const res = await EvolutionService.sendContact(params.instanceName, params.number, params.contact);
      const latencyMs = Date.now() - start;

      if (res.success) {
        this.circuitBreaker.recordSuccess();
        const msgId = res.data?.key?.id;
        return EvolutionApiMapper.mapSuccess(res.data, latencyMs, msgId);
      }

      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al enviar contacto en Evolution API',
          isRetryable: false,
          statusCode: 502,
          details: res.details
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async getChats(instanceName: string): Promise<EngineResult<any[]>> {
    try {
      const res = await EvolutionService.getChats(instanceName);
      if (res.success) {
        return EvolutionApiMapper.mapSuccess(res.data || []);
      }
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error obteniendo chats',
          isRetryable: false,
          statusCode: res.status || 500
        }
      };
    } catch (err: any) {
      return EvolutionApiMapper.mapFailure(err);
    }
  }

  public async getChatMessages(instanceName: string, remoteJid: string): Promise<EngineResult<any[]>> {
    try {
      const res = await EvolutionService.getChatMessages(instanceName, remoteJid);
      if (res.success) {
        const records = res.data?.messages?.records || res.data?.records || res.data || [];
        return EvolutionApiMapper.mapSuccess(records);
      }
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error obteniendo mensajes',
          isRetryable: false,
          statusCode: res.status || 500
        }
      };
    } catch (err: any) {
      return EvolutionApiMapper.mapFailure(err);
    }
  }

  public async getMediaMessageBase64(instanceName: string, messageKey: any, messageContent: any): Promise<EngineResult<any>> {
    try {
      const res = await EvolutionService.getMediaMessageBase64(instanceName, messageKey, messageContent);
      if (res.success) {
        return EvolutionApiMapper.mapSuccess(res.data);
      }
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error obteniendo media base64',
          isRetryable: false,
          statusCode: 500
        }
      };
    } catch (err: any) {
      return EvolutionApiMapper.mapFailure(err);
    }
  }

  public async markMessagesAsRead(instanceName: string, remoteJid: string, messageIds: string[], phoneJid?: string): Promise<EngineResult<boolean>> {
    try {
      const res = await EvolutionService.markMessagesAsRead(instanceName, remoteJid, messageIds, phoneJid);
      return EvolutionApiMapper.mapSuccess(res.success);
    } catch (err: any) {
      return EvolutionApiMapper.mapFailure(err);
    }
  }

  public async getGroups(instanceName: string, getParticipants: boolean = true): Promise<EngineResult<any[]>> {
    const start = Date.now();
    try {
      const res = await EvolutionService.getGroups(instanceName);
      const latencyMs = Date.now() - start;
      if (res.success) {
        this.circuitBreaker.recordSuccess();
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        return EvolutionApiMapper.mapSuccess(data, latencyMs);
      }
      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al obtener grupos de Evolution API',
          isRetryable: false,
          statusCode: res.status || 500
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async createGroup(instanceName: string, subject: string, participants: string[]): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const res = await EvolutionService.createGroup(instanceName, subject, participants);
      const latencyMs = Date.now() - start;
      if (res.success) {
        this.circuitBreaker.recordSuccess();
        return EvolutionApiMapper.mapSuccess(res.data, latencyMs);
      }
      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al crear grupo en Evolution API',
          isRetryable: false,
          statusCode: res.status || 500
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async updateGroupParticipants(instanceName: string, groupJid: string, action: 'add' | 'remove' | 'promote' | 'demote', participants: string[]): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const res = await EvolutionService.updateGroupParticipants(instanceName, groupJid, action, participants);
      const latencyMs = Date.now() - start;
      if (res.success) {
        this.circuitBreaker.recordSuccess();
        return EvolutionApiMapper.mapSuccess(res.data, latencyMs);
      }
      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al actualizar miembros del grupo',
          isRetryable: false,
          statusCode: res.status || 500
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async getGroupInviteCode(instanceName: string, groupJid: string): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const res = await EvolutionService.getGroupInviteCode(instanceName, groupJid);
      const latencyMs = Date.now() - start;
      if (res.success) {
        this.circuitBreaker.recordSuccess();
        return EvolutionApiMapper.mapSuccess(res.data, latencyMs);
      }
      this.circuitBreaker.recordFailure(res.error);
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: res.error || 'Error al obtener código de invitación del grupo',
          isRetryable: false,
          statusCode: res.status || 500
        },
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionApiMapper.mapFailure(err, latencyMs);
    }
  }

  public async healthCheck(): Promise<EngineHealth> {
    const isConfigured = Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
    if (!isConfigured) {
      return {
        engine: this.engineType,
        status: 'NOT_CONFIGURED',
        latencyMs: 0,
        configured: false,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: 'EVOLUTION_API_URL o EVOLUTION_API_KEY no definidos en variables de entorno.'
      };
    }

    const start = Date.now();
    try {
      const ping = await EvolutionService.getLicenseStatus();
      const latencyMs = Date.now() - start;

      return {
        engine: this.engineType,
        status: ping.success ? 'ONLINE' : 'DEGRADED',
        latencyMs,
        version: '2.4.0-rc2',
        configured: true,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: ping.error
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        engine: this.engineType,
        status: 'OFFLINE',
        latencyMs,
        version: '2.4.0-rc2',
        configured: true,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: err.message
      };
    }
  }
}

export const evolutionApiEngine = new EvolutionApiEngine();
