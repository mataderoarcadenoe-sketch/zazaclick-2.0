const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "ZAZA20";

async function run() {
  console.log("1. Fetching all chats for ZAZA20...");
  let chats = [];
  try {
    const resChats = await axios.post(`${evUrl}/chat/findChats/${instanceName}`, {}, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    // Evolution API returns chats in different formats depending on version
    chats = resChats.data || [];
    console.log(`Found ${chats.length} chats in Evolution API.`);
  } catch (err) {
    console.error("FindChats Error:", err.response?.data || err.message);
    return;
  }

  if (chats.length === 0) {
    console.log("No chats found.");
    return;
  }

  console.log("\n2. Checking messages for each chat...");
  for (let i = 0; i < Math.min(chats.length, 10); i++) {
    const chat = chats[i];
    const jid = chat.id || chat.remoteJid;
    if (!jid) continue;

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
      console.log(`- Chat JID: ${jid} | Name: ${chat.name || 'Unknown'} | Messages in Evolution DB: ${records.length}`);
    } catch (err) {
      console.error(`- Error for JID ${jid}:`, err.response?.data?.message || err.message);
    }
  }
}

run();
