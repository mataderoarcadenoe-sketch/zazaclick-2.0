const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "lwJAq9M4NwHmtM5bqk1k";
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

  console.log("\n2. Finding a media message for ZAZA20...");
  let mediaMsg = null;
  try {
    const resMsgs = await axios.post(`${evUrl}/chat/findMessages/${instanceName}`, { limit: 100 }, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    const records = resMsgs.data?.messages?.records || resMsgs.data?.records || resMsgs.data || [];
    console.log(`Found ${records.length} messages in history.`);
    
    for (const msg of records) {
      const content = msg.message;
      if (content && (content.imageMessage || content.stickerMessage || content.audioMessage || content.videoMessage || content.documentMessage)) {
        mediaMsg = msg;
        break;
      }
    }
  } catch (err) {
    console.error("FindMessages Error:", err.response?.data || err.message);
  }

  if (!mediaMsg) {
    console.log("No media message found in the last 100 messages.");
    return;
  }

  console.log("\nFound Media Message:", JSON.stringify(mediaMsg, null, 2));

  console.log("\n3. Requesting getBase64FromMediaMessage...");
  try {
    const payload = {
      message: {
        key: mediaMsg.key,
        message: mediaMsg.message
      }
    };
    console.log("Sending Payload:", JSON.stringify(payload, null, 2));
    
    const resBase64 = await axios.post(`${evUrl}/chat/getBase64FromMediaMessage/${instanceName}`, payload, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    console.log("Success status:", resBase64.status);
    console.log("Success data preview (keys):", Object.keys(resBase64.data));
  } catch (err) {
    console.error("getBase64FromMediaMessage Error Detailed:");
    console.log(JSON.stringify(err.response?.data || err.message, null, 2));
  }
}

run();
