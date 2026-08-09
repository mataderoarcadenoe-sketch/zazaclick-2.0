const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "Zaza2";

async function testJid(jid) {
  console.log(`\nTesting fetch for JID: ${jid} on instance ${instanceName}...`);
  try {
    const res = await axios.post(`${evUrl}/chat/findMessages/${instanceName}`, {
      where: {
        key: {
          remoteJid: jid
        }
      },
      limit: 100
    }, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    console.log(`- Success! Status: ${res.status}`);
    const records = res.data?.messages?.records || res.data?.records || res.data || [];
    console.log(`- Found ${records.length} records.`);
    if (records.length > 0) {
      console.log("- First message preview:", JSON.stringify(records[0], null, 2));
    }
  } catch (err) {
    console.error(`- Error (Status ${err.response?.status}):`, err.response?.data || err.message);
  }
}

async function run() {
  await testJid("199652041302076@lid");
  await testJid("51900892668@s.whatsapp.net");
}

run();
