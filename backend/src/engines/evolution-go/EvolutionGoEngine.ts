/**
 * Adapter Canónico para Evolution Go — Zaza Click 2.0
 */

import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
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
import { EvolutionGoMapper } from './EvolutionGoMapper';
import { validateSafeUrl, normalizeBase64 } from '../../utils/ssrf.util';

export class EvolutionGoEngine implements WhatsAppEngine {
  public readonly engineType: EngineType = 'evolution_go';
  public readonly capabilities: EngineCapabilities = {
    sendText: true,
    sendMedia: true,
    sendAudio: true,
    sendLocation: true,
    sendContact: true,
    webhooks: true,
    groups: true,
    chatsHistory: false
  };

  private circuitBreaker: CircuitBreaker;
  private api: AxiosInstance | null = null;

  constructor() {
    this.circuitBreaker = new CircuitBreaker('evolution_go', {
      failureThreshold: 5,
      cooldownPeriodMs: 30000
    });
    this.initHttpClient();
  }

  private initHttpClient(): void {
    const url = process.env.EVOLUTION_GO_URL;
    const key = process.env.EVOLUTION_GO_API_KEY;
    const timeout = parseInt(process.env.EVOLUTION_GO_TIMEOUT || '10000', 10);

    if (url) {
      this.api = axios.create({
        baseURL: url,
        headers: {
          'apikey': key || '',
          'Content-Type': 'application/json'
        },
        timeout,
        httpAgent: new http.Agent({ keepAlive: true, maxSockets: 50 }),
        httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 50 })
      });
    }
  }

  private getClient(): AxiosInstance {
    if (!this.api) {
      this.initHttpClient();
    }
    if (!this.api) {
      throw new Error('[EvolutionGoEngine] EVOLUTION_GO_URL no configurado.');
    }
    return this.api;
  }

  public async createInstance(instanceName: string): Promise<EngineResult<{ token: string; qrcode?: string; instance?: any }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const BACKEND_URL = process.env.BACKEND_URL || 'https://api.zazaclick.sbs';
      const webhookUrl = `${BACKEND_URL}/api/webhooks/whatsapp`;

      // Intentar eliminar la instancia previa en Go por si existía
      try {
        await client.delete(`/instance/delete/${instanceName}`);
      } catch {}

      const goKey = process.env.EVOLUTION_GO_API_KEY || 'F2C43224-3975-46EC-954A-FB335F5C9FDA';

      // Evolution Go OpenAPI: { name, token, proxy, webhook }
      const payload = {
        name: instanceName,
        instanceName: instanceName,
        token: goKey,
        qrcode: true,
        webhook: webhookUrl
      };

      const response = await client.post('/instance/create', payload);

      const latencyMs = Date.now() - start;
      const data = response.data?.data || response.data;
      const token = data?.token || data?.hash || data?.apikey || data?.instance?.token || goKey;
      const qrcode = data?.qrcode || data?.Qrcode || data?.base64;

      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess({
        token,
        qrcode,
        instance: data
      }, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async deleteInstance(instanceName: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let response;
      try {
        response = await client.delete(`/instance/delete/${instanceName}`);
      } catch (e) {
        response = await client.delete('/instance/delete', { headers: { instance: instanceName } });
      }
      const latencyMs = Date.now() - start;
      const success = response.status === 200 || response.status === 204;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(success, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async getConnectionState(instanceName: string): Promise<EngineResult<{ state: string; isConnected: boolean }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let response: any;
      try {
        response = await client.get('/instance/status', { headers: { instance: instanceName } });
      } catch (err: any) {
        try {
          response = await client.get(`/instance/connectionState/${instanceName}`);
        } catch {}
      }
      const latencyMs = Date.now() - start;
      const resData = response?.data?.data || response?.data;
      const isConnected = Boolean(resData?.LoggedIn === true || resData?.connected === true || resData?.state === 'open' || resData?.state === 'connected');
      const state = isConnected ? 'connected' : (resData?.Connected ? 'connecting' : 'disconnected');

      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess({ state, isConnected }, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionGoMapper.mapSuccess({ state: 'disconnected', isConnected: false }, latencyMs);
    }
  }

  public async reconnect(instanceName: string): Promise<EngineResult<{ state: string; isConnected: boolean; requiresQr?: boolean }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      try {
        await client.post('/instance/restart', {}, { headers: { instance: instanceName } });
      } catch {
        try {
          await client.post(`/instance/restart/${instanceName}`);
        } catch {}
      }

      // Esperar que whatsmeow restaure el socket
      let state = 'connecting';
      let isConnected = false;

      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const stateRes = await this.getConnectionState(instanceName);
        if (stateRes.data?.isConnected) {
          isConnected = true;
          state = 'connected';
          break;
        }
      }

      if (isConnected) {
        this.circuitBreaker.recordSuccess();
      }

      return EvolutionGoMapper.mapSuccess({
        state,
        isConnected,
        requiresQr: false
      }, Date.now() - start);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async getQRCode(instanceName: string): Promise<EngineResult<{ qrcode: string }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let response: any;

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          response = await client.get('/instance/qr', { headers: { instance: instanceName } });
        } catch (err: any) {
          try {
            response = await client.get(`/instance/connect/${instanceName}`);
          } catch (qrErr: any) {
            // Si la instancia no existe en Go, auto-crearla
            if (err.response?.status === 404 || qrErr.response?.status === 404 || err.response?.status === 401 || err.response?.data?.error?.includes('not found') || err.response?.data?.error?.includes('record not found')) {
              console.log(`⚠️ [EvolutionGoEngine] Instancia "${instanceName}" no existe en Evolution Go. Auto-creando...`);
              await this.createInstance(instanceName);
            }
          }
        }

        const resData = response?.data?.data || response?.data;
        const qrcode = resData?.qrcode || resData?.Qrcode || resData?.base64;

        if (qrcode) {
          this.circuitBreaker.recordSuccess();
          return EvolutionGoMapper.mapSuccess({ qrcode }, Date.now() - start);
        }

        if (attempt < 4) {
          await new Promise(r => setTimeout(r, 1200));
        }
      }

      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: 'Generando código QR en Evolution Go. Por favor reintenta en unos segundos.',
          isRetryable: true,
          statusCode: 422
        },
        latencyMs: Date.now() - start
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async logout(instanceName: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let response;
      try {
        response = await client.delete(`/instance/logout/${instanceName}`);
      } catch {
        response = await client.post('/instance/logout', {}, { headers: { instance: instanceName } });
      }
      const latencyMs = Date.now() - start;
      const success = response.status === 200 || response.status === 204;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(success, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async configureWebhook(instanceName: string, webhookUrl?: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const url = webhookUrl || `${process.env.BACKEND_URL || 'https://api.zazaclick.sbs'}/api/webhooks/whatsapp`;
      let response;
      try {
        response = await client.post(`/webhook/set/${instanceName}`, { url, enabled: true });
      } catch {
        response = await client.post('/webhook/set', { url, enabled: true }, { headers: { instance: instanceName } });
      }
      const latencyMs = Date.now() - start;
      return EvolutionGoMapper.mapSuccess(response.status === 200, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendTextMessage(params: SendTextMessageParams): Promise<EngineResult> {
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_UNAVAILABLE',
          message: 'Circuito abierto para Evolution Go debido a fallos continuos de red.',
          isRetryable: true,
          statusCode: 503
        }
      };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      let targetNumber = params.number;
      if (!targetNumber.includes('@')) {
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      let response;
      // Intento 1: Path-based (/message/sendText/:instance)
      // Intento 2: OpenAPI (/send/text) con header instance
      try {
        response = await client.post(`/message/sendText/${params.instanceName}`, {
          number: targetNumber,
          text: params.text
        });
      } catch (e: any) {
        if (e.response?.status === 404) {
          response = await client.post('/send/text', {
            number: targetNumber,
            text: params.text
          }, {
            headers: { instance: params.instanceName }
          });
        } else {
          throw e;
        }
      }

      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id || resData?.messageId;
        return EvolutionGoMapper.mapSuccess(response.data, latencyMs, msgId);
      }

      return EvolutionGoMapper.mapFailure(response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendMediaMessage(params: SendMediaMessageParams): Promise<EngineResult> {
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_UNAVAILABLE',
          message: 'Circuito abierto para Evolution Go.',
          isRetryable: true,
          statusCode: 503
        }
      };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      let targetNumber = params.number;
      if (!targetNumber.includes('@')) {
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      let finalMedia = normalizeBase64(params.media);

      if (params.media.startsWith('http://') || params.media.startsWith('https://')) {
        const ssrfCheck = await validateSafeUrl(params.media);
        if (!ssrfCheck.safe) {
          return {
            success: false,
            engine: this.engineType,
            error: {
              code: 'ENGINE_INVALID_REQUEST',
              message: `Seguridad SSRF: ${ssrfCheck.error}`,
              isRetryable: false,
              statusCode: 400
            }
          };
        }
      }

      let response;
      try {
        response = await client.post(`/message/sendMedia/${params.instanceName}`, {
          number: targetNumber,
          media: finalMedia,
          mediatype: params.mediatype,
          mimetype: params.mimetype,
          caption: params.caption,
          fileName: params.fileName
        });
      } catch (e: any) {
        if (e.response?.status === 404) {
          response = await client.post('/send/media', {
            number: targetNumber,
            url: finalMedia,
            type: params.mediatype,
            caption: params.caption,
            filename: params.fileName
          }, {
            headers: { instance: params.instanceName }
          });
        } else {
          throw e;
        }
      }

      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id;
        return EvolutionGoMapper.mapSuccess(response.data, latencyMs, msgId);
      }

      return EvolutionGoMapper.mapFailure(response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendAudioMessage(params: SendAudioMessageParams): Promise<EngineResult> {
    // Evolution Go maneja audio PTT a través de sendMedia con mediatype: 'audio'
    return this.sendMediaMessage({
      instanceName: params.instanceName,
      number: params.number,
      media: params.audio,
      mediatype: 'audio',
      mimetype: 'audio/mp4; codecs=opus'
    });
  }

  public async sendLocationMessage(params: SendLocationMessageParams): Promise<EngineResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let targetNumber = params.number;
      if (!targetNumber.includes('@')) {
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      let response;
      try {
        response = await client.post(`/message/sendLocation/${params.instanceName}`, {
          number: targetNumber,
          name: params.name,
          address: params.address,
          latitude: params.latitude,
          longitude: params.longitude
        });
      } catch (e: any) {
        if (e.response?.status === 404) {
          response = await client.post('/send/location', {
            number: targetNumber,
            name: params.name,
            address: params.address,
            latitude: params.latitude,
            longitude: params.longitude
          }, {
            headers: { instance: params.instanceName }
          });
        } else {
          throw e;
        }
      }
      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id;
        return EvolutionGoMapper.mapSuccess(response.data, latencyMs, msgId);
      }

      return EvolutionGoMapper.mapFailure(response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendContactMessage(params: SendContactMessageParams): Promise<EngineResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let targetNumber = params.number;
      if (!targetNumber.includes('@')) {
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      let response;
      try {
        response = await client.post(`/message/sendContact/${params.instanceName}`, {
          number: targetNumber,
          contact: params.contact
        });
      } catch (e: any) {
        if (e.response?.status === 404) {
          response = await client.post('/send/contact', {
            number: targetNumber,
            contact: params.contact
          }, {
            headers: { instance: params.instanceName }
          });
        } else {
          throw e;
        }
      }
      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id;
        return EvolutionGoMapper.mapSuccess(response.data, latencyMs, msgId);
      }

      return EvolutionGoMapper.mapFailure(response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async getGroups(instanceName: string, getParticipants: boolean = true): Promise<EngineResult<any[]>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let response;
      try {
        response = await client.get(`/group/fetchAllGroups/${instanceName}?getParticipants=${getParticipants}`);
      } catch (e: any) {
        if (e.response?.status === 404) {
          response = await client.get(`/group/all?getParticipants=${getParticipants}`, {
            headers: { instance: instanceName }
          });
        } else {
          throw e;
        }
      }
      const latencyMs = Date.now() - start;
      const data = response.data?.data || response.data || [];
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(Array.isArray(data) ? data : [], latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async createGroup(instanceName: string, subject: string, participants: string[]): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let response;
      try {
        response = await client.post(`/group/create/${instanceName}`, { subject, participants });
      } catch (e: any) {
        if (e.response?.status === 404) {
          response = await client.post('/group/create', { subject, participants }, {
            headers: { instance: instanceName }
          });
        } else {
          throw e;
        }
      }
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(response.data?.data || response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async updateGroupParticipants(instanceName: string, groupJid: string, action: 'add' | 'remove' | 'promote' | 'demote', participants: string[]): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let response;
      try {
        response = await client.post(`/group/updateParticipant/${instanceName}?groupJid=${groupJid}`, {
          action,
          participants
        });
      } catch (e: any) {
        if (e.response?.status === 404) {
          response = await client.post(`/group/participants?groupJid=${groupJid}`, {
            action,
            participants
          }, {
            headers: { instance: instanceName }
          });
        } else {
          throw e;
        }
      }
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(response.data?.data || response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async getGroupInviteCode(instanceName: string, groupJid: string): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let response;
      try {
        response = await client.get(`/group/inviteCode/${instanceName}?groupJid=${groupJid}`);
      } catch (e: any) {
        if (e.response?.status === 404) {
          response = await client.get(`/group/invite?groupJid=${groupJid}`, {
            headers: { instance: instanceName }
          });
        } else {
          throw e;
        }
      }
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(response.data?.data || response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async healthCheck(): Promise<EngineHealth> {
    const isEnabled = process.env.EVOLUTION_GO_ENABLED === 'true';
    const isConfigured = Boolean(process.env.EVOLUTION_GO_URL && process.env.EVOLUTION_GO_API_KEY);

    if (!isEnabled) {
      return {
        engine: this.engineType,
        status: 'DISABLED',
        latencyMs: 0,
        configured: isConfigured,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: 'Evolution Go está deshabilitado en configuración (EVOLUTION_GO_ENABLED=false).'
      };
    }

    if (!isConfigured) {
      return {
        engine: this.engineType,
        status: 'NOT_CONFIGURED',
        latencyMs: 0,
        configured: false,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: 'EVOLUTION_GO_URL o EVOLUTION_GO_API_KEY no definidos.'
      };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      let response: any;
      try {
        response = await client.get('/instance/all', { timeout: 4000 });
      } catch {
        response = await client.get('/health', { timeout: 4000 });
      }
      const latencyMs = Date.now() - start;

      return {
        engine: this.engineType,
        status: (response.status === 200 || response.status === 204) ? 'ONLINE' : 'DEGRADED',
        latencyMs,
        version: response.data?.version || '1.0.0',
        configured: true,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        engine: this.engineType,
        status: 'OFFLINE',
        latencyMs,
        configured: true,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: err.message
      };
    }
  }
}

export const evolutionGoEngine = new EvolutionGoEngine();
