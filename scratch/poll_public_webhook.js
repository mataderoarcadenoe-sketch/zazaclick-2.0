async function waitForPublicUrl() {
  const maxRetries = 25;
  const delay = 5000;

  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`[Intento ${i}/${maxRetries}] Consultando URL de webhook...`);
      const response = await fetch("https://zaza-click-20-production.up.railway.app/api/instances/webhook-diag/Chat01");
      
      if (response.status === 200) {
        const json = await response.json();
        const currentUrl = json.diag?.data?.url;
        console.log(`... URL actual registrada: ${currentUrl}`);
        
        if (currentUrl && currentUrl.startsWith("https://zaza-click-20-production")) {
          console.log("\n✅ ¡Sincronizado! El webhook apunta ahora a la URL pública:");
          console.log(JSON.stringify(json, null, 2));
          return;
        }
      }
    } catch (err) {
      console.log(`⚠️ Error: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.log("❌ La actualización de la URL en Railway tardó demasiado.");
}

waitForPublicUrl();
