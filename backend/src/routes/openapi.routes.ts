import { Router } from 'express';

const router = Router();

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Zaza Click 2.0 — WhatsApp API Developer Platform',
    version: '2.0.0',
    description: 'Multi-Engine WhatsApp API Gateway for ERP, CRM, and SaaS enterprise integrations. Supports Evolution API (Node.js/Baileys) and Evolution Go (whatsmeow) seamlessly.',
    contact: {
      name: 'Zaza Click Support',
      email: 'soporte@zazaclick.sbs',
      url: 'https://zazaclick.sbs'
    }
  },
  servers: [
    {
      url: 'https://api.zazaclick.sbs',
      description: 'Production API Gateway'
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Developer / Instance API Key for authentication'
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Client Session JWT Token'
      }
    },
    schemas: {
      CreateInstanceRequest: {
        type: 'object',
        required: ['instanceName'],
        properties: {
          instanceName: {
            type: 'string',
            example: 'erp_ventas_001',
            description: 'Unique alphanumeric identifier for the WhatsApp instance (letters, numbers, hyphens, underscores)'
          },
          engine: {
            type: 'string',
            enum: ['evolution_api', 'evolution_go'],
            default: 'evolution_api',
            description: 'Underlying WhatsApp engine'
          }
        }
      },
      SendTextRequest: {
        type: 'object',
        required: ['instanceName', 'number', 'text'],
        properties: {
          instanceName: {
            type: 'string',
            example: 'erp_ventas_001'
          },
          number: {
            type: 'string',
            example: '51912345678',
            description: 'Recipient phone number with country code'
          },
          text: {
            type: 'string',
            example: '¡Hola! Tu pedido #10492 está en camino.'
          }
        }
      },
      SendMediaRequest: {
        type: 'object',
        required: ['instanceName', 'number', 'mediatype', 'mimetype', 'media'],
        properties: {
          instanceName: { type: 'string', example: 'erp_ventas_001' },
          number: { type: 'string', example: '51912345678' },
          mediatype: {
            type: 'string',
            enum: ['image', 'video', 'document', 'audio'],
            example: 'image'
          },
          mimetype: { type: 'string', example: 'image/jpeg' },
          media: {
            type: 'string',
            example: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef',
            description: 'Public HTTPS URL or Base64 data URI'
          },
          caption: { type: 'string', example: 'Comprobante de Pago' },
          fileName: { type: 'string', example: 'factura_10492.pdf' }
        }
      },
      SendAudioRequest: {
        type: 'object',
        required: ['instanceName', 'number', 'audio'],
        properties: {
          instanceName: { type: 'string', example: 'erp_ventas_001' },
          number: { type: 'string', example: '51912345678' },
          audio: {
            type: 'string',
            example: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            description: 'Direct MP3/OGG URL or Base64 audio'
          }
        }
      },
      SendLocationRequest: {
        type: 'object',
        required: ['instanceName', 'number', 'latitude', 'longitude'],
        properties: {
          instanceName: { type: 'string', example: 'erp_ventas_001' },
          number: { type: 'string', example: '51912345678' },
          name: { type: 'string', example: 'Sede Principal' },
          address: { type: 'string', example: 'Av. República de Panamá 3545, San Isidro, Lima' },
          latitude: { type: 'number', example: -12.098412 },
          longitude: { type: 'number', example: -77.028941 }
        }
      },
      SendContactRequest: {
        type: 'object',
        required: ['instanceName', 'number', 'contact'],
        properties: {
          instanceName: { type: 'string', example: 'erp_ventas_001' },
          number: { type: 'string', example: '51912345678' },
          contact: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fullName: { type: 'string', example: 'Soporte Zaza Click' },
                phoneNumber: { type: 'string', example: '+51912345678' },
                organization: { type: 'string', example: 'Zaza Click' }
              }
            }
          }
        }
      },
      ApiResponseSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operación completada exitosamente.' },
          data: { type: 'object' }
        }
      },
      ApiResponseError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'MESSAGE_LIMIT_REACHED' },
          error: { type: 'string', example: 'Has alcanzado el límite máximo de mensajes.' }
        }
      }
    }
  },
  paths: {
    '/v1/instances': {
      post: {
        summary: 'Crear nueva instancia',
        description: 'Crea una línea de WhatsApp en el motor seleccionado (Evolution API o Evolution Go) desde tu ERP.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateInstanceRequest' } } }
        },
        responses: {
          201: { description: 'Instancia creada exitosamente' },
          400: { description: 'Límite de plan alcanzado o parámetros inválidos' },
          401: { description: 'API Key inválida' }
        }
      },
      get: {
        summary: 'Listar instancias',
        description: 'Obtiene todas las instancias registradas pertenecientes a la cuenta autenticada.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        responses: {
          200: { description: 'Lista de instancias con estados' }
        }
      }
    },
    '/v1/instances/{instanceName}/qr': {
      get: {
        summary: 'Obtener QR Code embebible',
        description: 'Devuelve el código QR en formato Base64 Data URI listo para renderizar directamente en la interfaz de tu ERP con `<img src="..." />`.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'instanceName', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Código QR generado' }
        }
      }
    },
    '/v1/instances/{instanceName}/status': {
      get: {
        summary: 'Consultar estado de conexión',
        description: 'Consulta en tiempo real si la instancia está conectada o desconectada.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'instanceName', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Estado en vivo de la conexión' }
        }
      }
    },
    '/v1/messages/text': {
      post: {
        summary: 'Enviar mensaje de texto',
        description: 'Envía un mensaje de texto de WhatsApp con reserva atómica de cuotas y protección de idempotencia.',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendTextRequest' } } }
        },
        responses: {
          200: { description: 'Mensaje enviado exitosamente' },
          429: { description: 'Límite de mensajes alcanzado' },
          502: { description: 'Fallo en motor de WhatsApp' }
        }
      }
    },
    '/v1/messages/media': {
      post: {
        summary: 'Enviar mensaje multimedia',
        description: 'Envía imagen, video, documento o audio a un número de WhatsApp.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMediaRequest' } } },
        },
        responses: {
          200: { description: 'Archivo multimedia enviado' }
        }
      }
    },
    '/v1/messages/audio': {
      post: {
        summary: 'Enviar nota de voz PTT',
        description: 'Envía un audio como nota de voz grabada al instante.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendAudioRequest' } } }
        },
        responses: {
          200: { description: 'Nota de voz enviada' }
        }
      }
    },
    '/v1/messages/location': {
      post: {
        summary: 'Enviar ubicación GPS',
        description: 'Envía coordenadas geográficas a WhatsApp.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendLocationRequest' } } }
        },
        responses: {
          200: { description: 'Ubicación enviada' }
        }
      }
    },
    '/v1/messages/contact': {
      post: {
        summary: 'Enviar contacto vCard',
        description: 'Envía una tarjeta de contacto telefónico.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendContactRequest' } } }
        },
        responses: {
          200: { description: 'Contacto enviado' }
        }
      }
    }
  }
};

router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

export default router;
