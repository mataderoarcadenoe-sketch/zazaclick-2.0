async function runDiag() {
  try {
    console.log("Realizando consulta de diagnóstico al backend de producción...");
    const response = await fetch("https://zaza-click-20-production.up.railway.app/api/instances/webhook-diag/Chat01");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const json = await response.json();
    console.log("\n--- RESULTADOS DE DIAGNÓSTICO EN PRODUCCIÓN ---");
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Error al ejecutar diagnóstico:", err.message);
  }
}

runDiag();
