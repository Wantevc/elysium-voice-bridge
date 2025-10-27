app.post("/telnyx", (req, res) => {
  try {
    console.log("POST /telnyx", JSON.stringify(req.body));
    return res.json({
      data: {
        actions: [
          { answer: {} },
          { speak: { voice: "female", language: "en-US", payload: "Hello from Elysium Voice!" } },
          { fork_start: { ws_url: "wss://elysium-voice-bridge.onrender.com/stream" } }
        ]
      }
    });
  } catch (e) {
    console.error("telnyx static error", e);
    return res.json({ data: { actions: [] } });
  }
});