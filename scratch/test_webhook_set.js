const realKey = 'B6D711FCDE4D4FD5936544120E713976';
const instance = 'Syscom.click';
const webhookUrl = 'https://zaza-click-20-production.up.railway.app/api/webhooks/whatsapp';

async function setWebhook() {
  try {
    console.log(`Intentando registrar webhook para ${instance}...`);
    
    const payload1 = {
      enabled: true,
      url: webhookUrl,
      byEvents: true,
      events: [
        "MESSAGES_UPSERT",
        "CHATS_UPDATE",
        "MESSAGES_UPDATE"
      ]
    };
    
    console.log("Enviando Payload 1 (plano)...");
    const response = await fetch(`https://api.wps.sycompro.com/webhook/set/${instance}`, {
      method: 'POST',
      headers: {
        'apikey': realKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload1)
    });
    
    const resultText = await response.text();
    console.log(`Respuesta HTTP ${response.status}:`);
    console.log(resultText);
    
  } catch (err) {
    console.error("Error ejecutando setWebhook:", err.message);
    if (err.cause) {
      console.error("Causa del error:", err.cause);
    }
  }
}

setWebhook();
