import React, { useState } from 'react';
import {
  Server,
  Send,
  Download,
  Copy,
  CheckCircle2,
  Globe,
  Radio,
  ExternalLink,
  Zap,
  Lock,
  Boxes,
  Compass,
  FileCode
} from 'lucide-react';

interface InstanceData {
  id: string;
  instance_name: string;
  api_key: string;
  engine_type?: string;
  status: string;
}

interface DeveloperPlatformDocsProps {
  instances: InstanceData[];
  userApiKey?: string;
}

export const DeveloperPlatformDocs: React.FC<DeveloperPlatformDocsProps> = ({
  instances,
  userApiKey
}) => {
  const [activeSection, setActiveSection] = useState<'getting-started' | 'erp-guide' | 'instances-api' | 'messages-api' | 'webhooks'>('getting-started');
  const [selectedLang, setSelectedLang] = useState<'curl' | 'javascript' | 'nodejs' | 'python' | 'php' | 'java' | 'csharp'>('curl');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeInstance = instances[0] || {
    instance_name: 'erp_ventas_001',
    api_key: userApiKey || 'zaza_live_sec_89f2a0b1c2d3e4f5',
    engine_type: 'evolution_go',
    status: 'connected'
  };

  const currentApiKey = activeInstance.api_key || userApiKey || 'zaza_live_sec_89f2a0b1c2d3e4f5';
  const currentInstanceName = activeInstance.instance_name || 'erp_ventas_001';
  const BASE_URL = 'https://api.zazaclick.sbs';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadPostmanCollection = () => {
    const postmanCollection = {
      info: {
        name: "Zaza Click 2.0 — WhatsApp API",
        _postman_id: "zaza-click-v2-collection",
        description: "Official Postman Collection for Zaza Click 2.0 WhatsApp API Gateway (Evolution Go Engine).",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      variable: [
        { key: "BASE_URL", value: BASE_URL, type: "string" },
        { key: "API_KEY", value: currentApiKey, type: "string" },
        { key: "INSTANCE_NAME", value: currentInstanceName, type: "string" },
        { key: "RECIPIENT_NUMBER", value: "51912345678", type: "string" }
      ],
      item: [
        {
          name: "1. Instances (ERP Management)",
          item: [
            {
              name: "Create Instance",
              request: {
                method: "POST",
                header: [
                  { key: "x-api-key", value: "{{API_KEY}}", type: "text" },
                  { key: "Content-Type", value: "application/json", type: "text" }
                ],
                body: {
                  mode: "raw",
                  raw: JSON.stringify({ instanceName: "{{INSTANCE_NAME}}", engine: "evolution_go" }, null, 2)
                },
                url: { raw: "{{BASE_URL}}/v1/instances", host: ["{{BASE_URL}}"], path: ["v1", "instances"] }
              }
            },
            {
              name: "List Instances",
              request: {
                method: "GET",
                header: [{ key: "x-api-key", value: "{{API_KEY}}", type: "text" }],
                url: { raw: "{{BASE_URL}}/v1/instances", host: ["{{BASE_URL}}"], path: ["v1", "instances"] }
              }
            },
            {
              name: "Get Instance QR Code",
              request: {
                method: "GET",
                header: [{ key: "x-api-key", value: "{{API_KEY}}", type: "text" }],
                url: { raw: "{{BASE_URL}}/v1/instances/{{INSTANCE_NAME}}/qr", host: ["{{BASE_URL}}"], path: ["v1", "instances", "{{INSTANCE_NAME}}", "qr"] }
              }
            },
            {
              name: "Get Connection Status",
              request: {
                method: "GET",
                header: [{ key: "x-api-key", value: "{{API_KEY}}", type: "text" }],
                url: { raw: "{{BASE_URL}}/v1/instances/{{INSTANCE_NAME}}/status", host: ["{{BASE_URL}}"], path: ["v1", "instances", "{{INSTANCE_NAME}}", "status"] }
              }
            },
            {
              name: "Logout Instance",
              request: {
                method: "POST",
                header: [{ key: "x-api-key", value: "{{API_KEY}}", type: "text" }],
                url: { raw: "{{BASE_URL}}/v1/instances/{{INSTANCE_NAME}}/logout", host: ["{{BASE_URL}}"], path: ["v1", "instances", "{{INSTANCE_NAME}}", "logout"] }
              }
            },
            {
              name: "Delete Instance",
              request: {
                method: "DELETE",
                header: [{ key: "x-api-key", value: "{{API_KEY}}", type: "text" }],
                url: { raw: "{{BASE_URL}}/v1/instances/{{INSTANCE_NAME}}", host: ["{{BASE_URL}}"], path: ["v1", "instances", "{{INSTANCE_NAME}}"] }
              }
            }
          ]
        },
        {
          name: "2. Messages (Outbound)",
          item: [
            {
              name: "Send Text Message",
              request: {
                method: "POST",
                header: [
                  { key: "x-api-key", value: "{{API_KEY}}", type: "text" },
                  { key: "Content-Type", value: "application/json", type: "text" },
                  { key: "Idempotency-Key", value: "pedido-msg-001", type: "text" }
                ],
                body: {
                  mode: "raw",
                  raw: JSON.stringify({ instanceName: "{{INSTANCE_NAME}}", number: "{{RECIPIENT_NUMBER}}", text: "¡Hola! Mensaje enviado desde Zaza Click API." }, null, 2)
                },
                url: { raw: "{{BASE_URL}}/v1/messages/text", host: ["{{BASE_URL}}"], path: ["v1", "messages", "text"] }
              }
            },
            {
              name: "Send Media Message",
              request: {
                method: "POST",
                header: [
                  { key: "x-api-key", value: "{{API_KEY}}", type: "text" },
                  { key: "Content-Type", value: "application/json", type: "text" }
                ],
                body: {
                  mode: "raw",
                  raw: JSON.stringify({
                    instanceName: "{{INSTANCE_NAME}}",
                    number: "{{RECIPIENT_NUMBER}}",
                    mediatype: "image",
                    mimetype: "image/jpeg",
                    media: "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef",
                    caption: "Catálogo Oficial"
                  }, null, 2)
                },
                url: { raw: "{{BASE_URL}}/v1/messages/media", host: ["{{BASE_URL}}"], path: ["v1", "messages", "media"] }
              }
            },
            {
              name: "Send Audio PTT",
              request: {
                method: "POST",
                header: [
                  { key: "x-api-key", value: "{{API_KEY}}", type: "text" },
                  { key: "Content-Type", value: "application/json", type: "text" }
                ],
                body: {
                  mode: "raw",
                  raw: JSON.stringify({
                    instanceName: "{{INSTANCE_NAME}}",
                    number: "{{RECIPIENT_NUMBER}}",
                    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                  }, null, 2)
                },
                url: { raw: "{{BASE_URL}}/v1/messages/audio", host: ["{{BASE_URL}}"], path: ["v1", "messages", "audio"] }
              }
            },
            {
              name: "Send Location",
              request: {
                method: "POST",
                header: [
                  { key: "x-api-key", value: "{{API_KEY}}", type: "text" },
                  { key: "Content-Type", value: "application/json", type: "text" }
                ],
                body: {
                  mode: "raw",
                  raw: JSON.stringify({
                    instanceName: "{{INSTANCE_NAME}}",
                    number: "{{RECIPIENT_NUMBER}}",
                    name: "Sede Principal",
                    address: "Av. República de Panamá 3545, San Isidro, Lima",
                    latitude: -12.098412,
                    longitude: -77.028941
                  }, null, 2)
                },
                url: { raw: "{{BASE_URL}}/v1/messages/location", host: ["{{BASE_URL}}"], path: ["v1", "messages", "location"] }
              }
            }
          ]
        }
      ]
    };

    const blob = new Blob([JSON.stringify(postmanCollection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Zaza-Click-API.postman_collection.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSnippet = (endpoint: string, method: string, payload: any) => {
    const payloadJson = JSON.stringify(payload, null, 2);

    switch (selectedLang) {
      case 'curl':
        return `curl -X ${method} "${BASE_URL}${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${currentApiKey}" \\
  -H "Idempotency-Key: req_${Date.now()}" \\
  -d '${JSON.stringify(payload)}'`;

      case 'javascript':
        return `// JavaScript / Fetch API
const response = await fetch("${BASE_URL}${endpoint}", {
  method: "${method}",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${currentApiKey}",
    "Idempotency-Key": "req_${Date.now()}"
  },
  body: JSON.stringify(${payloadJson})
});

const data = await response.json();
console.log("Respuesta Zaza Click:", data);`;

      case 'nodejs':
        return `// Node.js (Axios)
const axios = require('axios');

async function sendWhatsApp() {
  try {
    const res = await axios.${method.toLowerCase()}("${BASE_URL}${endpoint}", ${payloadJson}, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "${currentApiKey}",
        "Idempotency-Key": "req_${Date.now()}"
      },
      timeout: 10000
    });
    console.log("Éxito:", res.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

sendWhatsApp();`;

      case 'python':
        return `# Python 3 (Requests)
import requests

url = "${BASE_URL}${endpoint}"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "${currentApiKey}",
    "Idempotency-Key": "req_${Date.now()}"
}
payload = ${JSON.stringify(payload, null, 4)}

try:
    response = requests.${method.toLowerCase()}(url, json=payload, headers=headers, timeout=10)
    data = response.json()
    print(f"Status Code: {response.status_code}")
    print("Respuesta:", data)
except requests.exceptions.RequestException as e:
    print(f"Error en la petición: {e}")`;

      case 'php': {
        const phpArray = Object.entries(payload)
          .map(([k, v]) => `    "${k}" => ${typeof v === 'string' ? `"${v}"` : typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(",\n");

        return `<?php
// PHP 8+ (cURL Nativo)
$url = "${BASE_URL}${endpoint}";

$payload = [
${phpArray}
];

$headers = [
    "Content-Type: application/json",
    "x-api-key: ${currentApiKey}",
    "Idempotency-Key: req_${Date.now()}"
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${method}");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);
echo "Status: " . $httpCode . "\\n";
print_r($result);
?>`;
      }

      case 'java':
        return `// Java 11+ (HttpClient)
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ZazaClickClient {
    public static void main(String[] args) throws Exception {
        String jsonPayload = """
${payloadJson}
        """;

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${BASE_URL}${endpoint}"))
            .header("Content-Type", "application/json")
            .header("x-api-key", "${currentApiKey}")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Status: " + response.statusCode());
        System.out.println("Response: " + response.body());
    }
}`;

      case 'csharp':
        return `// C# (.NET 6+)
using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("x-api-key", "${currentApiKey}");
        client.DefaultRequestHeaders.Add("Idempotency-Key", "req_${Date.now()}");

        var json = @"${payloadJson.replace(/"/g, '""')}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await client.PostAsync("${BASE_URL}${endpoint}", content);
        var result = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"Status: {response.StatusCode}");
        Console.WriteLine($"Body: {result}");
    }
}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Documentación */}
      <div className="surface-panel p-6 sm:p-7 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider surface-accent-emerald text-emerald-700 dark:text-emerald-300">
              Referencia Oficial API v2.0
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Documentación Técnica para Desarrolladores
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Integra WhatsApp directamente dentro de tu ERP, CRM, POS o software empresarial mediante llamadas HTTP estándar sobre el motor Evolution Go.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadPostmanCollection}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 cursor-pointer"
            >
              <Download size={15} />
              <span>Descargar Colección Postman</span>
            </button>
            <a
              href={`${BASE_URL}/openapi.json`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold surface-interactive text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <FileCode size={15} />
              <span>OpenAPI Spec</span>
              <ExternalLink size={12} className="opacity-60" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Layout: Sidebar Navigation + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <div className="surface-panel p-3 rounded-2xl space-y-1 sticky top-6">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Capítulos de Referencia
            </div>

            {[
              { id: 'getting-started', label: '1. Inicio Rápido y Errores', icon: Compass, badge: 'Base' },
              { id: 'erp-guide', label: '2. Flujo ERP Sin Panel', icon: Boxes, badge: 'Guía' },
              { id: 'instances-api', label: '3. API de Instancias', icon: Server, badge: '/v1/instances' },
              { id: 'messages-api', label: '4. API de Mensajes', icon: Send, badge: '/v1/messages' },
              { id: 'webhooks', label: '5. Webhooks HMAC-SHA256', icon: Radio, badge: 'Eventos' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer text-left ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-emerald-600 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {item.badge}
                  </span>
                </button>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 px-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500">Instancia para ejemplos:</div>
              <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 truncate surface-accent-emerald px-2 py-1.5 rounded-lg">
                {currentInstanceName}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">

          {/* 1. GETTING STARTED & HTTP CODES */}
          {activeSection === 'getting-started' && (
            <div className="surface-panel p-6 rounded-2xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Compass size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fundamentos de la API y Códigos de Respuesta</h2>
                  <p className="text-xs text-slate-500">URL Base, cabeceras de autenticación e interpretación de códigos HTTP.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl surface-interactive space-y-1.5">
                  <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                    <Globe size={14} className="text-emerald-600 dark:text-emerald-400" /> Base URL Oficial
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white select-all">
                    https://api.zazaclick.sbs
                  </div>
                  <p className="text-[11px] text-slate-500">Punto de entrada único para todas las peticiones REST.</p>
                </div>

                <div className="p-4 rounded-xl surface-interactive space-y-1.5">
                  <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                    <Lock size={14} className="text-emerald-600 dark:text-emerald-400" /> Autenticación
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 select-all">
                    x-api-key: TU_API_KEY
                  </div>
                  <p className="text-[11px] text-slate-500">Cabecera obligatoria en cada llamada HTTP.</p>
                </div>

                <div className="p-4 rounded-xl surface-interactive space-y-1.5">
                  <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-600 dark:text-amber-400" /> Idempotencia
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white select-all">
                    Idempotency-Key: uuid
                  </div>
                  <p className="text-[11px] text-slate-500">Opcional. Previene envíos duplicados ante reintentos de red.</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Catálogo Estándar de Códigos HTTP</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-mono text-[11px]">
                        <th className="pb-2.5 font-bold">HTTP</th>
                        <th className="pb-2.5 font-bold">Código Interno</th>
                        <th className="pb-2.5 font-bold">Significado y Acción Recomendada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      <tr>
                        <td className="py-2.5 text-emerald-600 font-bold">200 / 201</td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">SUCCESS</td>
                        <td className="py-2.5 font-sans text-slate-500">Solicitud procesada y entregada al motor Evolution Go.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-amber-600 font-bold">400</td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">BAD_REQUEST</td>
                        <td className="py-2.5 font-sans text-slate-500">Faltan parámetros requeridos (`instanceName`, `number` o `text`).</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-rose-600 font-bold">401</td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">INVALID_API_KEY</td>
                        <td className="py-2.5 font-sans text-slate-500">La cabecera `x-api-key` es inválida, fue revocada o no se envió.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-rose-600 font-bold">403</td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">SUBSCRIPTION_INACTIVE</td>
                        <td className="py-2.5 font-sans text-slate-500">La suscripción expiró o la instancia se encuentra suspendida.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-amber-600 font-bold">409</td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">IDEMPOTENCY_CONFLICT</td>
                        <td className="py-2.5 font-sans text-slate-500">Una petición con el mismo `Idempotency-Key` ya fue procesada.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-rose-600 font-bold">429</td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">MESSAGE_LIMIT_REACHED</td>
                        <td className="py-2.5 font-sans text-slate-500">Se alcanzó el límite de mensajes del plan o el rate-limit por minuto.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-rose-600 font-bold">502</td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">ENGINE_TIMEOUT</td>
                        <td className="py-2.5 font-sans text-slate-500">Tiempo de espera agotado en el motor; la cuota se revierte automáticamente.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. GUÍA DE INTEGRACIÓN ERP */}
          {activeSection === 'erp-guide' && (
            <div className="surface-panel p-6 rounded-2xl space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl surface-accent-indigo text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Boxes size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Integración Directa en ERP / CRM (Sin Panel Web)</h2>
                  <p className="text-xs text-slate-500">Controla todo el ciclo de vida de las líneas de WhatsApp desde la interfaz de tu propio software.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl surface-accent-emerald text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <strong>Operación 100% transparente:</strong> Tus usuarios pueden crear su línea, escanear el código QR dentro de tu sistema y enviar o recibir mensajes sin necesidad de abrir <code>app.zazaclick.sbs</code>.
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl surface-interactive space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Paso 1: Crear Instancia desde tu Backend</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">POST /v1/instances</span>
                  </div>
                  <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
{`POST ${BASE_URL}/v1/instances
Headers:
  x-api-key: ${currentApiKey}
Body:
  { "instanceName": "ventas_lima", "engine": "evolution_go" }`}
                  </pre>
                </div>

                <div className="p-4 rounded-xl surface-interactive space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Paso 2: Obtener y Mostrar el QR en tu Interfaz</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">GET /v1/instances/:name/qr</span>
                  </div>
                  <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
{`// Respuesta JSON:
{ "success": true, "qrcode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." }

// Renderizado directo en HTML / React / Vue:
<img src={data.qrcode} alt="Escanear con WhatsApp" width="260" />`}
                  </pre>
                </div>

                <div className="p-4 rounded-xl surface-interactive space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Paso 3: Verificar Estado de Conexión</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">GET /v1/instances/:name/status</span>
                  </div>
                  <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
{`{ "success": true, "instanceName": "ventas_lima", "state": "connected", "isConnected": true }`}
                  </pre>
                </div>

                <div className="p-4 rounded-xl surface-interactive space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Paso 4: Despachar Mensajes y Recibir Eventos</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">POST /v1/messages/text</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Envía comprobantes, alertas o notificaciones usando los endpoints de mensajería y recibe respuestas entrantes en tu Webhook.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. INSTANCES API REFERENCE */}
          {activeSection === 'instances-api' && (
            <div className="surface-panel p-6 rounded-2xl space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Server size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">API de Instancias y Grupos</h2>
                    <p className="text-xs text-slate-500">Crea, conecta, consulta y administra líneas y grupos de WhatsApp.</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 p-1 surface-interactive rounded-xl">
                  {(['curl', 'javascript', 'nodejs', 'python', 'php', 'java', 'csharp'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLang(lang)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer uppercase ${
                        selectedLang === lang
                          ? 'bg-slate-900 text-white dark:bg-emerald-600'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded surface-accent-emerald text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">POST</span>
                    /v1/instances — Crear Instancia
                  </span>
                  <button
                    onClick={() => copyToClipboard(renderSnippet('/v1/instances', 'POST', { instanceName: currentInstanceName, engine: 'evolution_go' }), 'inst-create')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'inst-create' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'inst-create' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
                  {renderSnippet('/v1/instances', 'POST', { instanceName: currentInstanceName, engine: 'evolution_go' })}
                </pre>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded surface-accent-indigo text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">GET</span>
                    /v1/instances/:instanceName/qr — Obtener Código QR (Base64)
                  </span>
                  <button
                    onClick={() => copyToClipboard(`curl -X GET "${BASE_URL}/v1/instances/${currentInstanceName}/qr" -H "x-api-key: ${currentApiKey}"`, 'inst-qr')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'inst-qr' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'inst-qr' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
{`curl -X GET "${BASE_URL}/v1/instances/${currentInstanceName}/qr" \\
  -H "x-api-key: ${currentApiKey}"`}
                </pre>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded surface-accent-indigo text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">GET</span>
                    /v1/instances/:instanceName/groups — Listar Grupos de WhatsApp
                  </span>
                  <button
                    onClick={() => copyToClipboard(`curl -X GET "${BASE_URL}/v1/instances/${currentInstanceName}/groups?getParticipants=true" -H "x-api-key: ${currentApiKey}"`, 'inst-groups')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'inst-groups' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'inst-groups' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
{`curl -X GET "${BASE_URL}/v1/instances/${currentInstanceName}/groups?getParticipants=true" \\
  -H "x-api-key: ${currentApiKey}"`}
                </pre>
              </div>
            </div>
          )}

          {/* 4. MESSAGES API REFERENCE */}
          {activeSection === 'messages-api' && (
            <div className="surface-panel p-6 rounded-2xl space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl surface-accent-emerald text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Send size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">API de Mensajes</h2>
                    <p className="text-xs text-slate-500">Envío de texto, imágenes, documentos PDF, notas de voz PTT y ubicaciones.</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 p-1 surface-interactive rounded-xl">
                  {(['curl', 'javascript', 'nodejs', 'python', 'php', 'java', 'csharp'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLang(lang)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer uppercase ${
                        selectedLang === lang
                          ? 'bg-slate-900 text-white dark:bg-emerald-600'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded surface-accent-emerald text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">POST</span>
                    /v1/messages/text — Envío de Texto
                  </span>
                  <button
                    onClick={() => copyToClipboard(renderSnippet('/v1/messages/text', 'POST', {
                      instanceName: currentInstanceName,
                      number: '51912345678',
                      text: '¡Hola! Tu pedido #10492 está confirmado.'
                    }), 'msg-text')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'msg-text' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'msg-text' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
                  {renderSnippet('/v1/messages/text', 'POST', {
                    instanceName: currentInstanceName,
                    number: '51912345678',
                    text: '¡Hola! Tu pedido #10492 está confirmado.'
                  })}
                </pre>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded surface-accent-emerald text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">POST</span>
                    /v1/messages/media — Envío Multimedia (Imagen / PDF)
                  </span>
                  <button
                    onClick={() => copyToClipboard(renderSnippet('/v1/messages/media', 'POST', {
                      instanceName: currentInstanceName,
                      number: '51912345678',
                      mediatype: 'image',
                      mimetype: 'image/jpeg',
                      media: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef',
                      caption: 'Factura Electrónica F001-2940',
                      fileName: 'factura.pdf'
                    }), 'msg-media')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'msg-media' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'msg-media' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
                  {renderSnippet('/v1/messages/media', 'POST', {
                    instanceName: currentInstanceName,
                    number: '51912345678',
                    mediatype: 'image',
                    mimetype: 'image/jpeg',
                    media: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef',
                    caption: 'Factura Electrónica F001-2940',
                    fileName: 'factura.pdf'
                  })}
                </pre>
              </div>
            </div>
          )}

          {/* 5. WEBHOOKS & EVENTOS ENTERPRISE (HMAC-SHA256) */}
          {activeSection === 'webhooks' && (
            <div className="surface-panel p-6 rounded-2xl space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl surface-accent-amber text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Radio size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Webhooks y Firma Criptográfica HMAC-SHA256</h2>
                  <p className="text-xs text-slate-500">Recibe eventos entrantes de WhatsApp en tiempo real con verificación de autenticidad.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl surface-accent-amber text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <Lock size={14} /> Firma Criptográfica en Cabecera
                </div>
                <p className="leading-relaxed">
                  Cada entrega incluye <code className="font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20">X-Zaza-Signature: sha256=&lt;hash&gt;</code> y <code className="font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20">X-Zaza-Timestamp</code> para validar que el evento proviene legítimamente de Zaza Click.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">1. Estructura del Payload Entrante</h3>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
{`// Cabeceras HTTP:
X-Zaza-Signature: sha256=a1b2c3d4e5f67890123456789abcdef...
X-Zaza-Timestamp: 1724712000
X-Zaza-Event: MESSAGE_RECEIVED

// Cuerpo JSON:
{
  "id": "evt_1724712000_abc123",
  "type": "MESSAGE_RECEIVED",
  "timestamp": 1724712000,
  "instanceName": "${currentInstanceName}",
  "engine": "evolution_go",
  "data": {
    "key": {
      "remoteJid": "51912345678@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0ABC12345"
    },
    "pushName": "Juan Pérez",
    "message": {
      "conversation": "Hola, quisiera consultar el estado de mi pedido."
    }
  }
}`}
                </pre>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">2. Verificación de Firma en Node.js (Express)</h3>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
{`const crypto = require('crypto');

app.post('/api/webhooks/whatsapp', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-zaza-signature'];
  const timestamp = req.headers['x-zaza-timestamp'];
  const webhookSecret = 'whsec_tu_secreto_aqui';

  const payloadToSign = \`\${timestamp}.\${req.body.toString('utf8')}\`;
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(payloadToSign).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return res.status(401).send('Firma inválida');
  }

  const event = JSON.parse(req.body.toString('utf8'));
  res.status(200).json({ received: true });
});`}
                </pre>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DeveloperPlatformDocs;
