const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "zaza_saas_jwt_secret_2026_super_key";
const backendUrl = "https://zaza-click-20-production.up.railway.app/api";

const token = jwt.sign({
  id: "user_1785654247524_367",
  tenantId: "user_1785654247524_367",
  role: "admin"
}, JWT_SECRET, { expiresIn: '1h' });

async function run() {
  console.log("--- QUERYING PRODUCTION BACKEND ---");
  try {
    // 1. Get Instances
    console.log("\n1. GET /instances/list");
    const instRes = await axios.get(`${backendUrl}/instances/list`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Instances:", instRes.data.data.map(i => ({ id: i.id, name: i.instance_name, status: i.status })));
    
    // Use first connected instance
    const connectedInst = instRes.data.data.find(i => i.status === 'connected') || instRes.data.data[0];
    if (!connectedInst) {
      console.log("No instances found.");
      return;
    }
    const instanceName = connectedInst.instance_name;
    console.log(`Using instance: ${instanceName}`);

    // 2. Get Chats
    console.log(`\n2. GET /instances/chats/${instanceName}`);
    const chatsRes = await axios.get(`${backendUrl}/instances/chats/${instanceName}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Total chats: ${chatsRes.data.data?.length}`);
    
    // Find group chats
    const groups = chatsRes.data.data.filter(c => c.remoteJid && c.remoteJid.endsWith('@g.us'));
    console.log(`Group chats count: ${groups.length}`);
    console.log("First 5 groups:");
    groups.slice(0, 5).forEach((g, idx) => {
      console.log(`[${idx}] JID: ${g.remoteJid} | pushName: ${g.pushName} | name: ${g.name}`);
    });

    // Look for group "UN"
    const unGroup = chatsRes.data.data.find(c => 
      c.remoteJid && c.remoteJid.endsWith('@g.us') && 
      ((c.pushName && c.pushName.toLowerCase() === 'un') || (c.name && c.name.toLowerCase() === 'un'))
    );
    
    if (unGroup) {
      console.log(`\nFound group UN:`, unGroup);
      
      // 3. Get Messages for UN group
      console.log(`\n3. Fetching messages for group UN JID: ${unGroup.remoteJid}`);
      const msgsRes = await axios.post(`${backendUrl}/instances/chats/${instanceName}/messages`, {
        remoteJid: unGroup.remoteJid,
        originalJid: unGroup.originalJid
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Messages count:", msgsRes.data.data?.length);
      if (msgsRes.data.data && msgsRes.data.data.length > 0) {
        console.log("First message:", JSON.stringify(msgsRes.data.data[0], null, 2));
      }
    } else {
      console.log("\nGroup 'UN' not found in chats list.");
      
      // Let's test with any group chat if one exists
      if (groups.length > 0) {
        const sampleGroup = groups[0];
        console.log(`\nTesting message fetch with group: ${sampleGroup.pushName} (${sampleGroup.remoteJid})`);
        const msgsRes = await axios.post(`${backendUrl}/instances/chats/${instanceName}/messages`, {
          remoteJid: sampleGroup.remoteJid
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Messages fetched:", msgsRes.data.success);
        console.log("Messages count:", msgsRes.data.data?.length);
      }
    }

  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
