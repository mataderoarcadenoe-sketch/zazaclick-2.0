import React, { useState } from 'react';
import {
  Server,
  Send,
  Download,
  Copy,
  CheckCircle2,
  Play,
  Globe,
  Radio,
  ExternalLink,
  Cpu,
  Zap,
  Lock,
  Boxes,
  Compass,
  FileCode,
  Sparkles
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
  const [activeSection, setActiveSection] = useState<'getting-started' | 'erp-guide' | 'instances-api' | 'messages-api' | 'webhooks' | 'multi-engine' | 'try-it-out'>('getting-started');
  const [selectedLang, setSelectedLang] = useState<'curl' | 'javascript' | 'nodejs' | 'python' | 'php' | 'java' | 'csharp'>('curl');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Selector de instancia activa para snippets
  const activeInstance = instances[0] || {
    instance_name: 'erp_ventas_001',
    api_key: userApiKey || 'zaza_live_sec_89f2a0b1c2d3e4f5',
    engine_type: 'evolution_go',
    status: 'connected'
  };

  const currentApiKey = activeInstance.api_key || userApiKey || 'zaza_live_sec_89f2a0b1c2d3e4f5';
  const currentInstanceName = activeInstance.instance_name || 'erp_ventas_001';
  const BASE_URL = 'https://api.zazaclick.sbs';

  // State para Try It Out Tester
  const [testerEndpoint, setTesterEndpoint] = useState<string>('/v1/messages/text');
  const [testerInstance, setTesterInstance] = useState<string>(currentInstanceName);
  const [testerApiKey, setTesterApiKey] = useState<string>(currentApiKey);
  const [testerNumber, setTesterNumber] = useState<string>('51912345678');
  const [testerText, setTesterText] = useState<string>('¡Hola! Mensaje de prueba desde Zaza Click Developer Platform.');
  const [testerLoading, setTesterLoading] = useState<boolean>(false);
  const [testerResponse, setTesterResponse] = useState<any>(null);
  const [testerStatus, setTesterStatus] = useState<number | null>(null);
  const [testerLatency, setTesterLatency] = useState<number | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Descargar Colección de Postman Oficial
  const downloadPostmanCollection = () => {
    const postmanCollection = {
      info: {
        name: "Zaza Click 2.0 — WhatsApp API",
        _postman_id: "zaza-click-v2-collection",
        description: "Official Postman Collection for Zaza Click 2.0 Multi-Engine WhatsApp API Gateway (Evolution API + Evolution Go).",
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

  // Ejecutar prueba en vivo en el Try It Out
  const runLiveTest = async () => {
    setTesterLoading(true);
    setTesterResponse(null);
    setTesterStatus(null);
    const start = Date.now();

    try {
      let payload: any = {
        instanceName: testerInstance,
        number: testerNumber
      };

      if (testerEndpoint.includes('text')) {
        payload.text = testerText;
      } else if (testerEndpoint.includes('media')) {
        payload.mediatype = 'image';
        payload.mimetype = 'image/jpeg';
        payload.media = 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef';
        payload.caption = 'Prueba de imagen desde Developer Platform';
      }

      const res = await fetch(`${BASE_URL}${testerEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': testerApiKey
        },
        body: JSON.stringify(payload)
      });

      const latency = Date.now() - start;
      const data = await res.json();
      setTesterStatus(res.status);
      setTesterLatency(latency);
      setTesterResponse(data);
    } catch (err: any) {
      const latency = Date.now() - start;
      setTesterStatus(500);
      setTesterLatency(latency);
      setTesterResponse({ success: false, error: err.message || 'Error de conexión' });
    } finally {
      setTesterLoading(false);
    }
  };

  // Generador de snippets por lenguaje
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

      case 'php':
        // Snippet PHP 100% válido y seguro
        const phpArray = Object.entries(payload)
          .map(([k, v]) => `    "${k}" => ${typeof v === 'string' ? `"${v}"` : typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(",\n");

        return `<?php
// PHP 8+ (cURL Nativo con Array Asociativo Válido)
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
      {/* Header Developer Platform */}
      <div className="surface-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl rounded-full pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Sparkles size={13} />
              Developer Platform SaaS
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Zaza Click Developer API
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Integra WhatsApp directamente dentro de tu <strong>ERP, CRM, POS, sistema de ventas o software empresarial</strong> mediante llamadas HTTP estándar con arquitectura Multi-Engine (Evolution API + Evolution Go).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadPostmanCollection}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#FF6C37] text-white hover:bg-[#FF6C37]/90 transition-all shadow-sm cursor-pointer"
            >
              <Download size={15} />
              <span>Descargar Postman (.json)</span>
            </button>
            <a
              href={`${BASE_URL}/openapi.json`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold surface-interactive text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
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
              Documentación & Guías
            </div>

            {[
              { id: 'getting-started', label: '1. Getting Started', icon: Compass, badge: 'Base' },
              { id: 'erp-guide', label: '2. Integración ERP', icon: Boxes, badge: 'Sin Panel' },
              { id: 'instances-api', label: '3. Instances API', icon: Server, badge: '/v1/instances' },
              { id: 'messages-api', label: '4. Messages API', icon: Send, badge: '/v1/messages' },
              { id: 'webhooks', label: '5. Webhooks & Eventos', icon: Radio, badge: 'Inbound' },
              { id: 'multi-engine', label: '6. Multi-Engine Gateway', icon: Cpu, badge: 'Go + Node' },
              { id: 'try-it-out', label: '7. Tester ("Try It Out")', icon: Play, badge: 'En Vivo' }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-emerald-600 font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
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

            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/80 px-3 space-y-1">
              <div className="text-[11px] font-medium text-slate-500">API Key Activa:</div>
              <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 truncate bg-emerald-500/10 p-1.5 rounded-lg">
                {currentApiKey}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">

          {/* 1. GETTING STARTED */}
          {activeSection === 'getting-started' && (
            <div className="space-y-6">
              <div className="surface-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Compass size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Getting Started — Introducción a la API</h2>
                    <p className="text-xs text-slate-500">Aprende los fundamentos de autenticación, Base URL y arquitectura de Zaza Click 2.0.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5">
                    <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      <Globe size={14} className="text-blue-500" /> Base URL Oficial
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white select-all">
                      https://api.zazaclick.sbs
                    </div>
                    <p className="text-[11px] text-slate-500">Punto de entrada universal para todas las llamadas API.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5">
                    <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      <Lock size={14} className="text-emerald-500" /> Autenticación
                    </div>
                    <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 select-all">
                      x-api-key: TU_API_KEY
                    </div>
                    <p className="text-[11px] text-slate-500">Cabecera requerida en cada petición HTTP.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5">
                    <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-500" /> Idempotencia
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white select-all">
                      Idempotency-Key: uuid
                    </div>
                    <p className="text-[11px] text-slate-500">Evita envíos duplicados ante reintentos de red.</p>
                  </div>
                </div>

                {/* Códigos de Error Estándar */}
                <div className="space-y-3 pt-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Códigos de Respuesta HTTP y Engine Error Codes</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-mono text-[11px]">
                          <th className="pb-2 font-bold">HTTP Code</th>
                          <th className="pb-2 font-bold">Engine Code</th>
                          <th className="pb-2 font-bold">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                        <tr>
                          <td className="py-2 text-emerald-600 font-bold">200 / 201</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">SUCCESS</td>
                          <td className="py-2 font-sans text-slate-500">Operación ejecutada con éxito.</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-rose-600 font-bold">401</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">INVALID_API_KEY</td>
                          <td className="py-2 font-sans text-slate-500">API Key no válida o no pertenece a la instancia.</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-amber-600 font-bold">409</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">IDEMPOTENCY_CONFLICT</td>
                          <td className="py-2 font-sans text-slate-500">Una solicitud idéntica ya está siendo procesada en Redis.</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-purple-600 font-bold">429</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">MESSAGE_LIMIT_REACHED</td>
                          <td className="py-2 font-sans text-slate-500">Límite de mensajes del plan alcanzado. Requiere recarga.</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-rose-500 font-bold">502</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">ENGINE_TIMEOUT</td>
                          <td className="py-2 font-sans text-slate-500">El motor de WhatsApp excedió el tiempo límite (10s). Rollback automático de cuota.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. GUÍA DE INTEGRACIÓN ERP (SIN PANEL WEB) */}
          {activeSection === 'erp-guide' && (
            <div className="space-y-6">
              <div className="surface-panel p-6 rounded-2xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Boxes size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">¿Puedo integrar Zaza Click sin usar el panel web?</h2>
                    <p className="text-xs text-slate-500">¡SÍ! Tu software empresarial (ERP, CRM o POS) puede controlar todo el ciclo de vida vía API REST.</p>
                  </div>
                </div>

                {/* Banner Destacado */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <strong>Cero dependencia del panel web:</strong> Tus clientes finales o usuarios de tu ERP pueden crear sus líneas, escanear el QR desde la pantalla de tu propio software y comenzar a enviar/recibir WhatsApp sin necesidad de entrar a <code>https://app.zazaclick.sbs</code>.
                  </div>
                </div>

                {/* Diagrama de Flujo Paso a Paso */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Flujo de Integración en 4 Pasos:</h3>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Paso 1: Crear Instancia desde tu ERP</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">POST /v1/instances</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Tu backend envía el nombre de la línea deseada y el motor (ej. <code>evolution_go</code>):</p>
                      <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
{`POST ${BASE_URL}/v1/instances
Headers:
  x-api-key: ${currentApiKey}
Body:
  { "instanceName": "ventas_lima", "engine": "evolution_go" }`}
                      </pre>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Paso 2: Obtener y Embeber QR en tu ERP</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">GET /v1/instances/:name/qr</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Zaza Click devuelve el QR en formato <code>Base64 Data URI</code> listo para renderizar en cualquier etiqueta <code>&lt;img&gt;</code> de tu sistema:</p>
                      <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
{`// Respuesta JSON de Zaza Click:
{ "success": true, "qrcode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." }

// En la interfaz de tu ERP (React, Vue, HTML o PHP):
<img src={data.qrcode} alt="Escanear con WhatsApp" width="280" />`}
                      </pre>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Paso 3: Detección Automática de Conexión</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">GET /v1/instances/:name/status</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Tu ERP consulta el estado o recibe el evento vía Webhook/Socket.io. Cuando el usuario escanea, el estado cambia a <code>connected</code>:</p>
                      <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
{`{ "success": true, "instanceName": "ventas_lima", "state": "connected", "isConnected": true }`}
                      </pre>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">Paso 4: Envío y Recepción Automatizada</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">POST /v1/messages/text</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Tu ERP envía notificaciones, facturas, recordatorios y recibe respuestas de clientes directamente en su propio webhook.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. INSTANCES API REFERENCE */}
          {activeSection === 'instances-api' && (
            <div className="space-y-6">
              <div className="surface-panel p-6 rounded-2xl space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Server size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Instances API — Administración de Líneas</h2>
                      <p className="text-xs text-slate-500">Crea, conecta, consulta y elimina instancias de WhatsApp de forma programática.</p>
                    </div>
                  </div>

                  {/* Selector de Lenguaje */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                    {(['curl', 'javascript', 'nodejs', 'python', 'php', 'java', 'csharp'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLang(lang)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer uppercase ${
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

                {/* Endpoint 1: Crear Instancia */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-mono text-[10px] font-bold">POST</span>
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

                {/* Endpoint 2: Obtener QR */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-mono text-[10px] font-bold">GET</span>
                      /v1/instances/:instanceName/qr — Obtener QR Code (Base64)
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
              </div>
            </div>
          )}

          {/* 4. MESSAGES API REFERENCE */}
          {activeSection === 'messages-api' && (
            <div className="space-y-6">
              <div className="surface-panel p-6 rounded-2xl space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Send size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Messages API — Envío de Mensajes</h2>
                      <p className="text-xs text-slate-500">Envío de texto, imágenes, videos, documentos, notas de voz PTT y ubicaciones.</p>
                    </div>
                  </div>

                  {/* Selector de Lenguaje */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                    {(['curl', 'javascript', 'nodejs', 'python', 'php', 'java', 'csharp'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLang(lang)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer uppercase ${
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

                {/* Envío de Texto */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-mono text-[10px] font-bold">POST</span>
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

                {/* Envío de Multimedia */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-mono text-[10px] font-bold">POST</span>
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
            </div>
          )}

          {/* 5. WEBHOOKS & EVENTOS ENTERPRISE (HMAC-SHA256) */}
          {activeSection === 'webhooks' && (
            <div className="space-y-6">
              <div className="surface-panel p-6 rounded-2xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Radio size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Webhooks para ERP (Firma HMAC-SHA256)</h2>
                    <p className="text-xs text-slate-500">Recibe eventos entrantes de WhatsApp en tiempo real de forma segura y verificable en tu backend.</p>
                  </div>
                </div>

                {/* Banner de Seguridad HMAC */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <Lock size={14} /> Firma Criptográfica Obligatoria
                  </div>
                  <p className="leading-relaxed">
                    Cada webhook emitido por Zaza Click incluye la cabecera <code className="font-mono font-bold bg-amber-500/20 px-1 py-0.5 rounded">X-Zaza-Signature: sha256=&lt;hash&gt;</code> y <code className="font-mono font-bold bg-amber-500/20 px-1 py-0.5 rounded">X-Zaza-Timestamp</code>. Tu ERP puede verificar que el payload no ha sido alterado y prevenir ataques de repetición (Replay Attacks).
                  </p>
                </div>

                {/* Paso 1: Configurar Webhook */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Paso 1: Registrar la URL de tu ERP vía API</h3>
                  <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
{`POST ${BASE_URL}/v1/instances/${currentInstanceName}/webhook
Headers:
  x-api-key: ${currentApiKey}
  Content-Type: application/json
Body:
  {
    "url": "https://tu-erp.com/api/webhooks/whatsapp",
    "enabled": true
  }

// Respuesta de Zaza Click:
{
  "success": true,
  "message": "URL de webhook para ERP y firma HMAC-SHA256 configuradas exitosamente.",
  "data": {
    "instanceName": "${currentInstanceName}",
    "webhookUrl": "https://tu-erp.com/api/webhooks/whatsapp",
    "webhookSecret": "whsec_8f2a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
    "signatureHeader": "X-Zaza-Signature",
    "algorithm": "HMAC-SHA256"
  }
}`}
                  </pre>
                </div>

                {/* Paso 2: Payload Canónico Entrante */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Paso 2: Formato del Evento Canónico</h3>
                  <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto">
{`// Cabeceras HTTP recibidas en tu ERP:
X-Zaza-Signature: sha256=a1b2c3d4e5f67890123456789abcdef...
X-Zaza-Timestamp: 1724712000
X-Zaza-Event: MESSAGE_RECEIVED
X-Zaza-Event-Id: evt_1724712000_abc123
X-Zaza-Delivery-Id: del_1724712000_xyz789

// Cuerpo JSON (Payload):
{
  "id": "evt_1724712000_abc123",
  "type": "MESSAGE_RECEIVED",
  "timestamp": 1724712000,
  "instanceName": "${currentInstanceName}",
  "tenantId": "user_1724000000",
  "engine": "evolution_go",
  "data": {
    "key": {
      "remoteJid": "51912345678@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0ABC12345"
    },
    "pushName": "Juan Pérez",
    "message": {
      "conversation": "Hola, quisiera consultar el estado de mi factura."
    }
  }
}`}
                  </pre>
                </div>

                {/* Paso 3: Validación de Firma en tu ERP */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Paso 3: Cómo Validar la Firma HMAC en tu ERP</h3>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Ejemplo en Node.js (Express):</div>
                    <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
{`const crypto = require('crypto');

app.post('/api/webhooks/whatsapp', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-zaza-signature']; // "sha256=..."
  const timestamp = req.headers['x-zaza-timestamp'];
  const webhookSecret = 'whsec_tu_secreto_aqui';

  // 1. Validar Anti-Replay: Timestamp no mayor a 300 segundos
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return res.status(400).send('Timestamp expirado (Replay Attack)');
  }

  // 2. Calcular firma esperada
  const payloadToSign = \`\${timestamp}.\${req.body.toString('utf8')}\`;
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(payloadToSign).digest('hex');

  // 3. Comparación en tiempo constante
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return res.status(401).send('Firma inválida');
  }

  const event = JSON.parse(req.body.toString('utf8'));
  console.log('Evento verificado:', event.type, event.data);

  // Responder 200 OK inmediatamente
  res.status(200).json({ received: true });
});`}
                    </pre>

                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 pt-2">Ejemplo en PHP:</div>
                    <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
{`<?php
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_ZAZA_SIGNATURE'] ?? '';
$timestamp = $_SERVER['HTTP_X_ZAZA_TIMESTAMP'] ?? '';
$webhookSecret = 'whsec_tu_secreto_aqui';

// 1. Validar ventana de tiempo (300s)
if (abs(time() - intval($timestamp)) > 300) {
    http_response_code(400);
    exit('Timestamp expirado');
}

// 2. Calcular firma
$payload = $timestamp . '.' . $rawBody;
$expectedSig = 'sha256=' . hash_hmac('sha256', $payload, $webhookSecret);

// 3. Verificar
if (!hash_equals($expectedSig, $signature)) {
    http_response_code(401);
    exit('Firma HMAC inválida');
}

$event = json_decode($rawBody, true);
// Procesar evento en el ERP...

http_response_code(200);
echo json_encode(['received' => true]);
?>`}
                    </pre>
                  </div>
                </div>

                {/* Política de Reintentos */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white uppercase">Política de Reintentos de Zaza Click:</div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Si el servidor de tu ERP responde con un código de error (HTTP 5xx, 429) o no responde en 5 segundos (Timeout), Zaza Click reintentará automáticamente la entrega con backoff exponencial: <strong>1er reintento: 30s | 2do reintento: 60s | 3er reintento: 120s | 4to reintento: 240s</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 6. MULTI-ENGINE GATEWAY */}
          {activeSection === 'multi-engine' && (
            <div className="space-y-6">
              <div className="surface-panel p-6 rounded-2xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Arquitectura Multi-Engine Gateway</h2>
                    <p className="text-xs text-slate-500">Zaza Click 2.0 unifica dos motores independientes bajo una misma API.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Evolution API (v2.4.0-rc2)</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Motor basado en <strong>Node.js y Baileys</strong>. Excelente compatibilidad, gestión completa de grupos, presencia, historiales de chat y catálogos interactivos.
                    </p>
                    <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                      engine: "evolution_api"
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Evolution Go (whatsmeow / Golang)</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Motor de alto rendimiento compilado en <strong>Go 1.24</strong>. Máxima velocidad de throughput, mínimo consumo de memoria RAM y latencias de envío ultrabajas.
                    </p>
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      engine: "evolution_go"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. TRY IT OUT INTERACTIVE TESTER */}
          {activeSection === 'try-it-out' && (
            <div className="space-y-6">
              <div className="surface-panel p-6 rounded-2xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Play size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">API Tester Interactivo ("Try It Out")</h2>
                    <p className="text-xs text-slate-500">Ejecuta peticiones reales contra la API de Zaza Click y examina el resultado en vivo.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Endpoint de Prueba:</label>
                      <select
                        value={testerEndpoint}
                        onChange={(e) => setTesterEndpoint(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="/v1/messages/text">POST /v1/messages/text (Texto)</option>
                        <option value="/v1/messages/media">POST /v1/messages/media (Imagen)</option>
                        <option value="/api/webhooks/send-text">POST /api/webhooks/send-text (Legacy)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Nombre de Instancia:</label>
                      <input
                        type="text"
                        value={testerInstance}
                        onChange={(e) => setTesterInstance(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">API Key:</label>
                      <input
                        type="text"
                        value={testerApiKey}
                        onChange={(e) => setTesterApiKey(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Número de Destino:</label>
                      <input
                        type="text"
                        value={testerNumber}
                        onChange={(e) => setTesterNumber(e.target.value)}
                        placeholder="51912345678"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Texto del Mensaje:</label>
                      <textarea
                        rows={2}
                        value={testerText}
                        onChange={(e) => setTesterText(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
                      />
                    </div>

                    <button
                      onClick={runLiveTest}
                      disabled={testerLoading}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {testerLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Play size={14} />
                          <span>Ejecutar Petición Real</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Consola de Respuesta */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-500">Respuesta HTTP:</span>
                      {testerStatus && (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            testerStatus >= 200 && testerStatus < 300
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-rose-500/10 text-rose-600'
                          }`}>
                            HTTP {testerStatus}
                          </span>
                          {testerLatency && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {testerLatency}ms
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono h-64 overflow-y-auto leading-relaxed">
                      {testerResponse ? JSON.stringify(testerResponse, null, 2) : '// Haz clic en "Ejecutar Petición Real" para ver la respuesta JSON aquí...'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
export default DeveloperPlatformDocs;
