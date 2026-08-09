const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "Zaza2";
const remoteJid = "199652041302076@lid";

async function run() {
  console.log("Fetching messages from Evolution API...");
  try {
    const res = await axios.post(`${evUrl}/chat/findMessages/${instanceName}`, {
      where: {
        key: {
          remoteJid: remoteJid
        }
      },
      limit: 10
    }, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    
    console.log("Raw response type:", typeof res.data, Array.isArray(res.data) ? "is Array" : "is not Array");
    console.log("Raw response keys:", Object.keys(res.data));
    if (res.data.messages) {
      console.log("res.data.messages type:", typeof res.data.messages, Array.isArray(res.data.messages) ? "is Array" : "is not Array");
      console.log("res.data.messages keys:", Object.keys(res.data.messages));
    }
    const records = res.data?.messages?.records || res.data?.records || [];
    console.log(`Found ${records.length} records.`);
    
    for (let i = 0; i < Math.min(records.length, 5); i++) {
      const msg = records[i];
      console.log(`\nMessage [${i+1}] ID: ${msg.key?.id || msg.id}`);
      console.log("- MessageUpdate type:", typeof msg.MessageUpdate, Array.isArray(msg.MessageUpdate) ? "is Array" : "is not Array");
      console.log("- MessageUpdate value:", JSON.stringify(msg.MessageUpdate));
    }
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

run();
