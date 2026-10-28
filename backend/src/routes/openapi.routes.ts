import { Router } from 'express';

const router = Router();

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Zaza Click 2.0 — WhatsApp API Developer Platform',
    version: '2.0.2',
    description: 'High-Performance WhatsApp API Gateway for ERP, CRM, and SaaS enterprise integrations powered by Evolution Go (Whatsmeow) with atomic quotas, distributed idempotency and HMAC-signed outbound webhooks.',
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
      },
      PartnerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Master Partner API Key for B2B Tenant Provisioning (VivesFit & ERPs)'
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
            enum: ['evolution_go'],
            default: 'evolution_go',
            description: 'Underlying WhatsApp engine (Evolution Go / Whatsmeow)'
          }
        }
      },
      ConfigureWebhookRequest: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            example: 'https://mi-erp.com/api/webhooks/whatsapp',
            description: 'Public HTTPS webhook destination URL for incoming WhatsApp events'
          },
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable or disable outbound webhook delivery'
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
            description: 'Recipient phone number with country code (e.g. 51912345678) OR WhatsApp Group JID (e.g. 120363024823948@g.us)'
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
          number: {
            type: 'string',
            example: '51912345678',
            description: 'Recipient phone number with country code (e.g. 51912345678) OR WhatsApp Group JID (e.g. 120363024823948@g.us)'
          },
          mediatype: {
            type: 'string',
            enum: ['image', 'video', 'document', 'audio'],
            example: 'document'
          },
          mimetype: { type: 'string', example: 'application/pdf' },
          media: {
            type: 'string',
            example: 'data:application/pdf;base64,JVBERi0...',
            description: 'Public HTTPS URL, raw Base64, or Base64 data URI. Locally supplied PDF: maximum 8 MiB, valid header and EOF.'
          },
          caption: { type: 'string', example: 'Comprobante de Pago' },
          fileName: { type: 'string', example: 'factura_10492.pdf' }
        }
      },
      CreateGroupRequest: {
        type: 'object',
        required: ['subject', 'participants'],
        properties: {
          subject: {
            type: 'string',
            example: 'Clientes VIP 2026',
            description: 'Group title/name'
          },
          participants: {
            type: 'array',
            items: { type: 'string', example: '51912345678' },
            description: 'Array of participant phone numbers'
          }
        }
      },
      ManageGroupParticipantsRequest: {
        type: 'object',
        required: ['groupJid', 'action', 'participants'],
        properties: {
          groupJid: {
            type: 'string',
            example: '120363024823948@g.us',
            description: 'WhatsApp Group JID'
          },
          action: {
            type: 'string',
            enum: ['add', 'remove', 'promote', 'demote'],
            example: 'add'
          },
          participants: {
            type: 'array',
            items: { type: 'string', example: '51912345678' }
          }
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
      CanonicalWebhookEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'evt_1724712000_a9b8c7' },
          type: {
            type: 'string',
            enum: ['MESSAGE_RECEIVED', 'MESSAGE_STATUS_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'CHATS_UPDATE', 'PRESENCE_UPDATE'],
            example: 'MESSAGE_RECEIVED'
          },
          timestamp: { type: 'integer', example: 1724712000 },
          instanceName: { type: 'string', example: 'erp_ventas_001' },
          tenantId: { type: 'string', example: 'user_1724000000' },
          engine: { type: 'string', example: 'evolution_go' },
          data: { type: 'object' }
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
          code: {
            type: 'string',
            enum: [
              'INVALID_API_KEY',
              'INVALID_REQUEST',
              'IDEMPOTENCY_CONFLICT',
              'IDEMPOTENCY_PAYLOAD_MISMATCH',
              'DELIVERY_UNCERTAIN',
              'INSUFFICIENT_SCOPE',
              'TEST_KEY_SEND_DISABLED',
              'OPERATION_UNAVAILABLE',
              'INVALID_DOCUMENT',
              'RATE_LIMIT_EXCEEDED',
              'MESSAGE_LIMIT_REACHED',
              'SSRF_BLOCKED',
              'INVALID_WEBHOOK_URL',
              'ENGINE_TIMEOUT',
              'ENGINE_UNAVAILABLE',
              'ENGINE_SEND_FAILED',
              'UNKNOWN_DELIVERY',
              'INTERNAL_ERROR'
            ],
            example: 'MESSAGE_LIMIT_REACHED'
          },
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
          401: { description: 'API Key inválida' },
          429: { description: 'Rate limit excedido' }
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
          200: { description: 'Código QR generado en Base64 Data URI' }
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
    '/v1/instances/{instanceName}/webhook': {
      post: {
        summary: 'Configurar Webhook para ERP (Firma HMAC)',
        description: 'Registra la URL de destino del ERP con validación estricta anti-SSRF y genera un secreto de firma HMAC-SHA256.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'instanceName', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ConfigureWebhookRequest' } } }
        },
        responses: {
          200: { description: 'Webhook configurado exitosamente con secreto HMAC' },
          400: { description: 'URL bloqueada por política anti-SSRF o inválida' }
        }
      }
    },
    '/v1/instances/{instanceName}/groups': {
      get: {
        summary: 'Listar grupos de WhatsApp',
        description: 'Obtiene la lista completa de grupos de WhatsApp asociados a la instancia con sus JIDs (@g.us), nombres y número de participantes.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'instanceName', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'getParticipants', in: 'query', required: false, schema: { type: 'boolean', default: true } }
        ],
        responses: {
          200: { description: 'Lista de grupos obtenida exitosamente' },
          403: { description: 'Instancia no autorizada' },
          502: { description: 'Error al consultar grupos en el motor' }
        }
      },
      post: {
        summary: 'Crear nuevo grupo de WhatsApp',
        description: 'Crea un nuevo grupo de WhatsApp desde el ERP indicando el título y los participantes iniciales.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'instanceName', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateGroupRequest' } } }
        },
        responses: {
          201: { description: 'Grupo creado exitosamente en WhatsApp' }
        }
      }
    },
    '/v1/instances/{instanceName}/groups/participants': {
      post: {
        summary: 'Administrar miembros del grupo',
        description: 'Añadir, remover, promover o degradar participantes de un grupo de WhatsApp.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'instanceName', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ManageGroupParticipantsRequest' } } }
        },
        responses: {
          200: { description: 'Miembros actualizados exitosamente' }
        }
      }
    },
    '/v1/instances/{instanceName}/groups/{groupId}/invite-code': {
      get: {
        summary: 'Obtener enlace de invitación al grupo',
        description: 'Genera o consulta el enlace de invitación pública de WhatsApp para unirse al grupo.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'instanceName', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' }, description: 'Group JID (ej. 120363024823948@g.us o 120363024823948)' }
        ],
        responses: {
          200: { description: 'Enlace de invitación generado exitosamente' }
        }
      }
    },
    '/v1/messages/text': {
      post: {
        summary: 'Enviar mensaje de texto',
        description: 'Envía un mensaje de texto de WhatsApp con reserva atómica de cuotas y protección de idempotencia.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: false, description: 'Stable operation UUID, reused only for identical retries. Persist before sending. Never generate a new key on timeout.', schema: { type: 'string', maxLength: 128 } }
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendTextRequest' } } }
        },
        responses: {
          200: { description: 'ACCEPTED by engine; does not prove recipient delivery. Includes operationId and messageId when supplied by engine.' },
          409: { description: 'Operation in progress, uncertain outcome, or changed payload. Query operation before retrying.' },
          429: { description: 'Límite de mensajes alcanzado' },
          503: { description: 'Authorization or durable operation storage unavailable; query the existing key before retrying.' }
        }
      }
    },
    '/v1/messages/media': {
      post: {
        summary: 'Enviar mensaje multimedia',
        description: 'Envía multimedia con operación durable. PDFs locales: document/application/pdf, base64, hasta 8 MiB. Una aceptación del motor no demuestra entrega al cliente.',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 128 }, description: 'Reuse the same key and content for retries. Query state after a timeout; do not create a second operation.' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMediaRequest' } } }
        },
        responses: {
          200: { description: 'ACCEPTED by engine; response includes operationId. Recipient delivery is not asserted.' },
          400: { description: 'Invalid or incomplete PDF; nothing sent.' },
          409: { description: 'Existing, uncertain or mismatched operation; no second send.' },
          429: { description: 'No available subscription quota.' },
          503: { description: 'Durable operation storage or authorization unavailable.' }
        }
      }
    },
    '/v1/message-operations/{operationId}': {
      get: {
        summary: 'Consultar una operación propia sin reenviarla',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [{name: 'operationId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}],
        responses: {200: {description: 'PROCESSING, ACCEPTED, REJECTED or UNKNOWN; delivered/read are null until a verified event exists.'}, 404: {description: 'No authorized operation found.'}}
      }
    },
    '/v1/message-operations/by-key/{instanceName}/{key}': {
      get: {
        summary: 'Reconciliar una respuesta perdida usando la clave original',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          {name: 'instanceName', in: 'path', required: true, schema: {type: 'string'}},
          {name: 'key', in: 'path', required: true, schema: {type: 'string', maxLength: 128}}
        ],
        responses: {200: {description: 'Current authorized operation state, without resending.'},404: {description: 'Operation not found; does not prove a pre-upgrade request was not delivered.'}}
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
    },
    '/v1/b2b/tenants': {
      post: {
        summary: 'Aprovisionar nuevo Gimnasio/Tenant (B2B Partner)',
        description: 'Crea de forma atómica un nuevo gimnasio con su Plan, Suscripción, API Key e Instancia WhatsApp en una sola llamada.',
        security: [{ PartnerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['companyName', 'email'],
                properties: {
                  companyName: { type: 'string', example: 'Power Fitness Miraflores' },
                  externalId: { type: 'string', example: 'gym_001' },
                  email: { type: 'string', example: 'contacto@powerfitness.com' },
                  phone: { type: 'string', example: '+51999888777' },
                  planId: { type: 'string', example: 'plan_basic' },
                  durationMonths: { type: 'integer', example: 1 },
                  instanceName: { type: 'string', example: 'powerfit_wsp' },
                  webhookUrl: { type: 'string', example: 'https://api.vivesfit.com/webhooks/zazaclick' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Tenant aprovisionado con éxito con su API Key y líneas' }
        }
      },
      get: {
        summary: 'Listar Gimnasios/Tenants aprovisionados',
        description: 'Lista todos los tenants gestionados por el partner con su estado y vigencia.',
        security: [{ PartnerAuth: [] }],
        responses: {
          200: { description: 'Lista de tenants' }
        }
      }
    },
    '/v1/b2b/tenants/{id}': {
      get: {
        summary: 'Consultar dossier de un Gimnasio/Tenant',
        description: 'Obtiene el estado en vivo, consumo de mensajes y líneas vinculadas.',
        security: [{ PartnerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Dossier del tenant' }
        }
      },
      delete: {
        summary: 'Eliminar Gimnasio/Tenant en cascada',
        description: 'Elimina permanentemente el tenant y sus líneas de WhatsApp.',
        security: [{ PartnerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Tenant eliminado' }
        }
      }
    },
    '/v1/b2b/tenants/{id}/renew': {
      post: {
        summary: 'Renovar suscripción de un Gimnasio/Tenant',
        description: 'Ejecuta el Rolling Renewal por N meses y resetea cuota de mensajes.',
        security: [{ PartnerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  months: { type: 'integer', default: 1 },
                  resetQuota: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Suscripción renovada con éxito' }
        }
      }
    },
    '/v1/b2b/tenants/{id}/status': {
      put: {
        summary: 'Suspender / Reactivar Gimnasio/Tenant',
        description: 'Cambia el estado del tenant. Si se suspende, se bloquea el tráfico de WhatsApp de inmediato.',
        security: [{ PartnerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['active', 'suspended'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Estado comercial actualizado' }
        }
      }
    }
  }
};

router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

export default router;
