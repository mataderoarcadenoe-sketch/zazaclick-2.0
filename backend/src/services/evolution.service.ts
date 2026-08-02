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
   * Crear una nueva instancia de WhatsApp para el cliente
   */
  public static async createInstance(instanceName: string): Promise<{ success: boolean; instance?: any; error?: string }> {
    try {
      const response = await api.post('/instance/create', {
        instanceName,
        token: this.generateRandomToken(),
        qrcode: true,
        webhook: null, // Opcional: configurar si deseamos webhooks locales
      });

      if (response.data?.instance) {
        return { success: true, instance: response.data.instance };
      }
      return { success: false, error: 'Respuesta inválida de Evolution API' };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error(`[EvolutionService] Error creando instancia ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg };
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
      const errorMsg = err.response?.data?.message || err.message;
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
      const cleanNumber = number.replace(/\D/g, '');
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
}
