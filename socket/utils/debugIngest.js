const DEBUG_INGEST_URL =
  "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51";

function createDebugIngest() {
  return async function logDebug(runId, message, data = {}, hypothesisId = "N") {
    try {
      await fetch(DEBUG_INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `log_${Date.now()}_${runId}`,
          timestamp: Date.now(),
          message,
          data,
          sessionId: "debug-session",
          runId,
          hypothesisId,
        }),
      });
    } catch (_error) {
      // Keep behavior non-blocking.
    }
  };
}

module.exports = {
  createDebugIngest,
};
