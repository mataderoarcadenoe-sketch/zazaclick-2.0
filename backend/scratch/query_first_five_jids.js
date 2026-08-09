const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "Zaza2";

async function run() {
  console.log("1. Fetching active chats list from Evolution API...");
  try {
    const resChats = await axios.post(`${evUrl}/chat/findChats/${instanceName}`, {}, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    
    const chats = resChats.data || [];
    console.log(`- Found ${chats.length} active chats.`);
    
    const sampleChats = chats.slice(0, 5);
    for (let i = 0; i < sampleChats.length; i++) {
      const chat = sampleChats[i];
      const jid = chat.remoteJid;
      console.log(`\n[${i+1}/5] Chat remoteJid: ${jid} | pushName: ${chat.pushName}`);
      
      console.log(`  Querying findMessages for ${jid}...`);
      const startTime = Date.now();
      try {
        const resMsgs = await axios.post(`${evUrl}/chat/findMessages/${instanceName}`, {
          where: {
            key: {
              remoteJid: jid
            }
          },
          limit: 50
        }, {
          headers: { apikey: evKey, 'Content-Type': 'application/json' }
        });
        
        const records = resMsgs.data?.messages?.records || resMsgs.data?.records || resMsgs.data || [];
        console.log(`  ✅ Success in ${Date.now() - startTime}ms! Found ${records.length} messages.`);
      } catch (err) {
        console.log(`  ❌ Failed in ${Date.now() - startTime}ms:`, err.response?.data || err.message);
      }
    }
  } catch (err) {
    console.error("Error fetching chats:", err.response?.data || err.message);
  }
}

run();
