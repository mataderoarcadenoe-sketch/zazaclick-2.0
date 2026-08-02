import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;

if (!EVOLUTION_URL || !EVOLUTION_KEY) {
  console.warn('⚠️ [EvolutionService] EVOLUTION_API_URL o EVOLUTION_API_KEY no configurados.');
}

const api = axios.create({
  baseURL: EVOLUTION_URL,
  headers: {
    'apikey': EVOLUTION_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export class EvolutionService {

  /**
   * Extrae y formatea el mensaje de error de una excepción de Axios
   */
  private static parseError(err: any): string {
    if (err.response) {
      const data = err.response.data;
      if (data) {
        if (typeof data === 'string') {
          return data;
        }
        if (typeof data === 'object') {
          // NestJS/Evolution API anidan a veces el error en data.response (ej: response: { message: ["Invalid integration"] })
          const nested = data.response;
          let message = null;
          if (nested && typeof nested === 'object') {
            message = nested.message || nested.error || nested.err;
          }
          if (!message) {
            message = data.message || data.error || data.err;
          }

          if (message) {
            if (Array.isArray(message)) {
              return message.join(', ');
            }
            if (typeof message === 'object') {
              return JSON.stringify(message);
            }
            return String(message);
          }
        }
      }
      return `Error ${err.response.status}: ${err.response.statusText || 'Petición incorrecta'}`;
    }
    if (err.request) {
      return 'No se recibió respuesta del servidor de Evolution API. Verifica que esté en línea.';
    }
    return err.message;
  }

  /**
   * Crear una nueva instancia de WhatsApp para el cliente
   */
  public static async createInstance(instanceName: string): Promise<{ success: boolean; instance?: any; error?: string; status?: number }> {
    try {
      const response = await api.post('/instance/create', {
        instanceName,
        token: this.generateRandomToken(),
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: null, // Opcional: configurar si deseamos webhooks locales
      });

      if (response.data?.instance) {
        const token = response.data.hash || response.data.instance.token || response.data.instance.apikey;
        return {
          success: true,
          instance: {
            ...response.data.instance,
            token
          }
        };
      }
      return { success: false, error: 'Respuesta inválida de Evolution API', status: 502 };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      const status = err.response?.status || 500;
      console.error(`[EvolutionService] Error creando instancia ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status };
    }
  }

  /**
   * Obtener el estado actual de la conexión (connected, disconnected, etc.)
   */
  public static async getConnectionState(instanceName: string): Promise<string> {
    try {
      const response = await api.get(`/instance/connectionState/${instanceName}`);
      return response.data?.instance?.state || 'disconnected';
    } catch (err: any) {
      // Si devuelve 404, asumimos que no existe o está desconectada
      return 'disconnected';
    }
  }

  /**
   * Obtener el código QR en Base64 o JSON para escanear
   */
  public static async getQRCode(instanceName: string): Promise<{ success: boolean; qrcode?: string; error?: string }> {
    try {
      const response = await api.get(`/instance/connect/${instanceName}`);
      if (response.data?.base64) {
        return { success: true, qrcode: response.data.base64 };
      }
      return { success: false, error: 'No se generó el código QR' };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Cerrar sesión (Logout) del número sin eliminar la instancia
   */
  public static async logout(instanceName: string): Promise<boolean> {
    try {
      const response = await api.delete(`/instance/logout/${instanceName}`);
      return response.status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * Eliminar por completo la instancia de Evolution API
   */
  public static async deleteInstance(instanceName: string): Promise<boolean> {
    try {
      const response = await api.delete(`/instance/delete/${instanceName}`);
      return response.status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * Enviar un mensaje de texto a través de una instancia específica
   */
  public static async sendTextMessage(instanceName: string, number: string, text: string): Promise<boolean> {
    try {
      let cleanNumber = number.replace(/\D/g, '');
      if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
        cleanNumber = `51${cleanNumber}`;
      }
      const response = await api.post(`/message/sendText/${instanceName}`, {
        number: cleanNumber,
        text: text,
      });
      return response.status === 200 || response.status === 201;
    } catch (err: any) {
      console.error(`[EvolutionService] Error enviando mensaje a ${number}:`, err.message);
      return false;
    }
  }

  /**
   * Obtener el estado actual de la licencia de Evolution API
   */
  public static async getLicenseStatus(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.get('/license/status');
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error obteniendo estado de licencia:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generar la URL de registro de licencia
   */
  public static async registerLicense(redirectUri: string): Promise<{ success: boolean; registerUrl?: string; error?: string }> {
    try {
      const response = await api.get(`/license/register?redirect_uri=${encodeURIComponent(redirectUri)}`);
      if (response.data?.register_url || response.data?.url) {
        return { success: true, registerUrl: response.data.register_url || response.data.url };
      }
      return { success: false, error: 'No se generó la URL de registro.' };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error registrando licencia:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Activar la licencia usando el código de callback
   */
  public static async activateLicense(code: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.get(`/license/activate?code=${code}`);
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error activando licencia con código:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Obtener chats activos de la instancia
   */
  public static async getChats(instanceName: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.post(`/chat/findChats/${instanceName}`, {});
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo chats para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Obtener mensajes de un chat específico
   */
  public static async getChatMessages(instanceName: string, remoteJid: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.post(`/chat/findMessages/${instanceName}`, {
        where: {
          key: {
            remoteJid: remoteJid
          }
        },
        limit: 100
      });
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo mensajes para ${remoteJid}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Obtener el Base64 de un archivo multimedia
   */
  public static async getMediaMessageBase64(instanceName: string, messageKey: any, messageContent: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.post(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        message: {
          key: messageKey,
          message: messageContent
        }
      });
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo base64 de multimedia:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generador de tokens aleatorios para asegurar las instancias de los clientes
   */
  private static generateRandomToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 20; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Unificar chats @lid con sus números reales para evitar conversaciones duplicadas
   */
  public static mergeChats(chats: any[]): any[] {
    const mergedMap = new Map<string, any>();

    for (const chat of chats) {
      if (chat.remoteJid === 'status@broadcast') continue;

      let realJid = chat.remoteJid;

      // Limpiar el sufijo de puerto :0 si existe
      if (realJid.includes(':0@s.whatsapp.net')) {
        realJid = realJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
      }

      // Si es un @lid, intentamos obtener su número real de remoteJidAlt
      if (realJid.endsWith('@lid') && chat.lastMessage?.key?.remoteJidAlt) {
        realJid = chat.lastMessage.key.remoteJidAlt;
      }
      
      // Volver a limpiar por si el remoteJidAlt vino con :0
      if (realJid.includes(':0@s.whatsapp.net')) {
        realJid = realJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
      }

      const existing = mergedMap.get(realJid);
      
      if (!existing) {
        // Primer vez que vemos este JID real
        const newChat = { ...chat, remoteJid: realJid, originalJid: chat.remoteJid };
        mergedMap.set(realJid, newChat);
      } else {
        // Fusionar si ya existía
        const currentTs = chat.lastMessage?.messageTimestamp || 0;
        const existingTs = existing.lastMessage?.messageTimestamp || 0;
        
        if (currentTs > existingTs) {
          const merged = { 
            ...chat, 
            remoteJid: realJid,
            originalJid: chat.remoteJid,
            profilePicUrl: chat.profilePicUrl || existing.profilePicUrl,
            pushName: chat.pushName || existing.pushName,
            unreadCount: (chat.unreadCount || 0) + (existing.unreadCount || 0)
          };
          mergedMap.set(realJid, merged);
        } else {
          existing.profilePicUrl = existing.profilePicUrl || chat.profilePicUrl;
          existing.pushName = existing.pushName || chat.pushName;
          existing.unreadCount = (existing.unreadCount || 0) + (chat.unreadCount || 0);
          mergedMap.set(realJid, existing);
        }
      }
    }

    // Ordenar por el timestamp del último mensaje de forma descendente
    return Array.from(mergedMap.values()).sort((a, b) => {
      const tsA = a.lastMessage?.messageTimestamp || 0;
      const tsB = b.lastMessage?.messageTimestamp || 0;
      return tsB - tsA;
    });
  }
}
