import { OAuth2Client } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const OFFICIAL_CLIENT_ID = '782722800100-4j8107m9nn2r0ngt6b4e17r2s2166l19.apps.googleusercontent.com';
const SYSCOM_ANDROID_CLIENT_ID = '572176809201-8o2c3qpug8mkik2pvd0bcbp1nk7belks.apps.googleusercontent.com';
const ALLOWED_CLIENT_IDS = Array.from(new Set([
  OFFICIAL_CLIENT_ID,
  SYSCOM_ANDROID_CLIENT_ID,
  process.env.GOOGLE_CLIENT_ID,
  '6104299697-7dissi3tuvd84q94737nqmsi96nmh2d5.apps.googleusercontent.com'
].filter(Boolean) as string[]));

const client = new OAuth2Client();

export class GoogleService {
  public static supportsSyscomAndroid(): boolean { return ALLOWED_CLIENT_IDS.includes(SYSCOM_ANDROID_CLIENT_ID); }
  /**
   * Verificar y decodificar el token de identidad JWT provisto por Google
   */
  public static async verifyToken(token: string): Promise<{ email: string; email_verified?: boolean; name?: string; picture?: string } | null> {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: ALLOWED_CLIENT_IDS,
      });

      const payload = ticket.getPayload();
      
      if (payload && payload.email) {
        return {
          email: payload.email,
          email_verified: payload.email_verified,
          name: payload.name,
          picture: payload.picture
        };
      }
      
      return null;
    } catch (err: any) {
      console.error('[GoogleService] Error verificando token de Google:', err.message);
      return null;
    }
  }
}
