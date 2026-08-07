const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "ZAZA20";

async function run() {
  console.log("1. Checking connection state for ZAZA20...");
  try {
    const resConn = await axios.get(`${evUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: evKey }
    });
    console.log("Connection State Response:", resConn.data);
  } catch (err) {
    console.error("Connection State Error:", err.response?.data || err.message);
  }

  console.log("\n2. Finding media messages for ZAZA20...");
  let mediaMsgs = [];
  try {
    const resMsgs = await axios.post(`${evUrl}/chat/findMessages/${instanceName}`, { limit: 100 }, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    const records = resMsgs.data?.messages?.records || resMsgs.data?.records || resMsgs.data || [];
    console.log(`Found ${records.length} messages in history.`);
    
    for (const msg of records) {
      const content = msg.message;
      if (content && (content.imageMessage || content.stickerMessage || content.audioMessage || content.videoMessage || content.documentMessage)) {
        mediaMsgs.push(msg);
      }
    }
  } catch (err) {
    console.error("FindMessages Error:", err.response?.data || err.message);
  }

  if (mediaMsgs.length === 0) {
    console.log("No media messages found in the last 100 messages.");
    return;
  }

  console.log(`\nFound ${mediaMsgs.length} media messages. Testing them...`);

  for (let i = 0; i < mediaMsgs.length; i++) {
    const mediaMsg = mediaMsgs[i];
    const msgId = mediaMsg.key?.id;
    const msgTime = new Date(mediaMsg.messageTimestamp * 1000).toLocaleString();
    const msgType = mediaMsg.messageType || Object.keys(mediaMsg.message || {})[0];
    
    console.log(`\nTesting [${i+1}/${mediaMsgs.length}] ID: ${msgId} | Type: ${msgType} | Time: ${msgTime}`);
    try {
      const payload = {
        message: {
          key: mediaMsg.key,
          message: mediaMsg.message
        }
      };
      
      const resBase64 = await axios.post(`${evUrl}/chat/getBase64FromMediaMessage/${instanceName}`, payload, {
        headers: { apikey: evKey, 'Content-Type': 'application/json' }
      });
      console.log(`  ✅ Success! Status: ${resBase64.status}`);
    } catch (err) {
      const errMsg = err.response?.data?.response?.message || err.response?.data || err.message;
      console.log(`  ❌ Failed:`, JSON.stringify(errMsg));
    }
  }
}

run();
