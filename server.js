app.post("/telnyx", async (req, res) => {
  const safe = (v, d) => (v === undefined || v === null ? d : v);
  try {
    const ev = safe(req.body?.data?.event_type, req.body?.event_type);
    const p  = safe(req.body?.data?.payload, req.body?.payload) || {};
    const called = (p.to || p.call_to || "").replace(/\s+/g,"").replace(/^00/,"+");

    let greeting = "Hello, thanks for calling. How can I help?";
    let lang = "en-US";

    try {
      if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
        const profile = await fetchProfileByNumber(called);
        const lm = { EN: "en-US", NL: "nl-NL", FR: "fr-FR" };
        if (profile) {
          greeting = profile["Tip Greeting Line"] || profile["Greeting Line"] || greeting;
          lang = lm[(profile.Language || "EN").toUpperCase()] || lang;
        }
      } else {
        console.warn("Airtable env missing; using default greeting.");
      }
    } catch (e) {
      console.error("Airtable lookup failed:", e);
    }

    if (ev === "call.initiated") {
      return res.json({
        data: {
          actions: [
            { answer: {} },
            { speak: { voice: "female", language: lang, payload: greeting } },
            { fork_start: { ws_url: "wss://elysium-voice-bridge.onrender.com/stream" } }
          ]
        }
      });
    }

    return res.json({ data: { actions: [] } });
  } catch (e) {
    console.error("Telnyx webhook fatal:", e);
    return res.json({ data: { actions: [] } });
  }
});