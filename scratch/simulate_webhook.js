async function triggerFakeWebhook() {
  const webhookUrl = "https://zaza-click-20-production.up.railway.app/api/webhooks/whatsapp";
  
  const payload = {
    event: "messages.upsert",
    instance: "Chat01",
    data: {
      key: {
        remoteJid: "51931175234@s.whatsapp.net",
        fromMe: false,
        id: `FAKE_${Date.now()}`
      },
      message: {
        conversation: "¡Mensaje de prueba en tiempo real desde el simulador!"
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };

  try {
    console.log("Enviando webhook de prueba al backend de Zaza...");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log(`Respuesta del servidor (HTTP ${response.status}):`, result);
  } catch (err) {
    console.error("Error al enviar webhook de prueba:", err.message);
  }
}

triggerFakeWebhook();
