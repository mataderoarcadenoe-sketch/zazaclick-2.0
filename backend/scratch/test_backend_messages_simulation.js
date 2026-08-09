const dotenv = require('dotenv');
const path = require('path');
// Mocks y variables
process.env.EVOLUTION_API_URL = "https://evolution-api-production-8b953.up.railway.app";
process.env.EVOLUTION_API_KEY = "4296088A962E3B1C5D4180A84D581F78";

// Importar Axios como lo hace EvolutionService
const axios = require('axios');
const api = axios.create({
  baseURL: process.env.EVOLUTION_API_URL,
  headers: {
    apikey: process.env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  }
});

async function getChatMessages(instanceName, remoteJid) {
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
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function run() {
  const instanceName = "Zaza2";
  const remoteJid = "199652041302076@lid";

  console.log("Simulating EvolutionService.getChatMessages...");
  const messagesResult = await getChatMessages(instanceName, remoteJid);
  console.log("Result success:", messagesResult.success);
  
  if (messagesResult.success) {
    const data = messagesResult.data;
    console.log("Type of messagesResult.data:", typeof data, Array.isArray(data) ? "is Array" : "is not Array");
    
    // Simular la logica de instance.routes.ts:
    const records = data?.messages?.records || data?.records || data || [];
    console.log("Evaluated records count:", records.length);
    if (records.length > 0) {
      console.log("First record ID:", records[0].id || records[0].key?.id);
    }
  }
}

run();
