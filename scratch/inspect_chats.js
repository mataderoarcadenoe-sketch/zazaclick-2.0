async function inspect() {
  const realKey = 'B6D711FCDE4D4FD5936544120E713976';
  const instance = 'Syscom.click';
  
  try {
    console.log("Consultando chats desde Evolution API usando fetch...");
    const response = await fetch(`https://api.wps.sycompro.com/chat/findChats/${instance}`, {
      method: 'POST',
      headers: {
        'apikey': realKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errText}`);
    }
    
    const chats = await response.json();
    console.log(`Total chats devueltos: ${chats.length}`);
    
    // Filtrar chats que tengan @lid
    const lidChats = chats.filter(c => c.remoteJid && c.remoteJid.includes('@lid'));
    console.log(`Chats con @lid: ${lidChats.length}`);
    
    if (lidChats.length > 0) {
      console.log("\n--- EJEMPLO DE CHAT CON LID ---");
      const sample = lidChats[0];
      console.log(JSON.stringify(sample, null, 2));
      
      if (sample.lastMessage) {
        console.log("\nlastMessage keys:", Object.keys(sample.lastMessage));
        if (sample.lastMessage.key) {
          console.log("lastMessage.key:", sample.lastMessage.key);
        }
      }
    } else {
      console.log("No se encontraron chats con @lid en la lista.");
    }
    
    console.log("\n--- ESTRUCTURA DE LOS PRIMEROS 3 CHATS ---");
    console.log(JSON.stringify(chats.slice(0, 3), null, 2));
    
  } catch (err) {
    console.error("Error en la consulta:", err.message);
  }
}

inspect();
