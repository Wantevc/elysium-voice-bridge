import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
  res.writeHead(404); res.end("not found");
});

const wss = new WebSocketServer({ server, path: "/stream" });

wss.on("connection", (ws, req) => {
  const u = new URL(req.url, `https://${req.headers.host}`);
  const params = Object.fromEntries(u.searchParams.entries());
  let streamSid = null;

  console.log("🎧 New Twilio stream", { params });

  ws.on("message", async (message) => {
    let data;
    try { data = JSON.parse(message.toString()); } catch (e) { return; }

    switch (data.event) {
      case "start":
        streamSid = data.start.streamSid;
        console.log("▶️  start", streamSid, data.start.customParameters || {});
        // TODO: init OpenAI Realtime here later
        break;

      case "media":
        // data.media.payload is base64 μ-law 8kHz, 20ms
        // TODO: forward to AI, then send audio back via:
        // ws.send(JSON.stringify({ event: "media", streamSid, media: { payload: base64UlawChunk } }));
        break;

      case "mark":
        break;

      case "stop":
        console.log("⏹️  stop", streamSid);
        try { ws.close(); } catch {}
        break;
    }
  });

  ws.on("close", () => console.log("🔌 WS closed", streamSid));
  ws.on("error", (e) => console.error("WS error", e));
});

server.listen(PORT, () => console.log(`Bridge listening on :${PORT}`));
