import http from "http";
import express from "express";
import fetch from "node-fetch";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

// ---------- Express app (HTTP endpoints) ----------
const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.status(200).send("ok"));

// ----- Airtable helpers -----
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Elysium Voice Users";

function normE164(s) { return s ? s.replace(/\s+/g, "").replace(/^00/, "+") : s; }

async function fetchProfileByNumber(e164) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}?filterByFormula=${encodeURIComponent(`{Telnyx Number}='${e164}'`)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
  if (!r.ok) throw new Error(`Airtable HTTP ${r.status}`);
  const j = await r.json();
  return j.records?.[0]?.fields || null;
}

const langMap = { EN: "en-US", NL: "nl-NL", FR: "fr-FR" };

// ----- Telnyx Call Control webhook -----
app.post("/telnyx", async (req, res) => {
  try {
    const ev = req.body?.data?.event_type || req.body?.event_type;
    const p  = req.body?.data?.payload    || req.body?.payload    || {};
    const called = normE164(p?.to || p?.call_to);

    const profile  = await fetchProfileByNumber(called);
    const greeting =
      profile?.["Tip Greeting Line"] ||
      profile?.["Greeting Line"] ||
      "Hello, thanks for calling. How can I help?";
    const lang = langMap[(profile?.Language || "EN").toUpperCase()] || "en-US";

    if (ev === "call.initiated") {
      return res.json({
        data: {
          actions: [
            { answer: {} },
            { speak: { voice: "female", language: lang, payload: greeting } }
          ]
        }
      });
    }

    return res.json({ data: { actions: [] } });
  } catch (e) {
    console.error("Telnyx webhook error:", e);
    return res.json({ data: { actions: [] } });
  }
});

// ---------- Single HTTP server used by BOTH HTTP & WS ----------
const server = http.createServer(app);

// ---------- WebSocket for media (your existing bridge) ----------
const wss = new WebSocketServer({ server, path: "/stream" });

wss.on("connection", (ws, req) => {
  const u = new URL(req.url, `https://${req.headers.host}`);
  const params = Object.fromEntries(u.searchParams.entries());
  let streamSid = null;

  console.log("🎧 New stream connected", { params });

  ws.on("message", async (message) => {
    let data;
    try { data = JSON.parse(message.toString()); } catch { return; }

    switch (data.event) {
      case "start":
        streamSid = data.start?.streamSid || "no-sid";
        console.log("▶️  start", streamSid);
        break;
      case "media":
        // data.media.payload is base64 μ-law 8kHz
        // TODO: forward to OpenAI Realtime and send back audio
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

// ---------- Listen ----------
server.listen(PORT, () => console.log(`Bridge listening on :${PORT}`));