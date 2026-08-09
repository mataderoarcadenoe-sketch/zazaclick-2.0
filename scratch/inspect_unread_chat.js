const axios = require('axios');

async function inspect() {
  const apiKey = 'B6D711FCDE4D4FD5936544120E713976';
  const instance = 'Syscom.click';
  
  try {
    console.log("Fetching chats from Evolution API...");
    const res = await axios.post(`https://api.wps.sycompro.com/chat/findChats/${instance}`, {}, {
      headers: { 'apikey': apiKey }
    });
    
    console.log(`Total chats: ${res.data.length}`);
    
    // Find groups or chats with UN
    const unChats = res.data.filter(c => 
      (c.pushName && c.pushName.toLowerCase().includes('un')) || 
      (c.name && c.name.toLowerCase().includes('un')) ||
      (c.remoteJid && c.remoteJid.toLowerCase().includes('un'))
    );
    
    console.log("\n--- CHATS WITH 'UN' ---");
    console.log(JSON.stringify(unChats.slice(0, 10), null, 2));
    
    // Let's print the first 10 group chats
    const groupChats = res.data.filter(c => c.remoteJid && c.remoteJid.endsWith('@g.us'));
    console.log(`\nTotal group chats: ${groupChats.length}`);
    console.log("\n--- FIRST 5 GROUP CHATS ---");
    console.log(JSON.stringify(groupChats.slice(0, 5), null, 2));

    // Also look for the active JID from the screenshot list
    // Like HERRERA SUCSE, WIKY ALEXIS (phone: 51931175234)
    const wiky = res.data.find(c => c.remoteJid && c.remoteJid.includes('51931175234'));
    console.log(`\nWiky Alexis chat entry:`);
    console.log(JSON.stringify(wiky, null, 2));

  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

inspect();
