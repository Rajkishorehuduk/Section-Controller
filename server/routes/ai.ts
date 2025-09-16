import type { RequestHandler } from "express";

const MODEL = process.env.GEMINI_MODEL || "models/gemini-1.5-pro";

function buildPrompt(payload: any) {
  const { live, inputs } = payload;
  const lines = ["Up Main", "Down Main", "Reverse"] as const;
  const blocked = lines.filter((l) => live?.blocked?.[l]);
  return `You are a rail traffic assistant for an Indian Railways section controller.
Current live loads per line (number of active movements queued or passing):
- Up Main: ${live?.loads?.["Up Main"] ?? 0}
- Down Main: ${live?.loads?.["Down Main"] ?? 0}
- Reverse: ${live?.loads?.["Reverse"] ?? 0}
Blocked lines: ${blocked.length ? blocked.join(", ") : "None"}.
Train context:
- Priority: ${inputs?.priority}
- Destination: ${inputs?.destination}
- Current position: ${inputs?.currentPosition}

Task: Propose safe and efficient strategies considering Indian railway operations terminology:
- pass_through: best line to pass now
- crossing: use loop station to cross an opposing movement
- precedence: give way to higher-priority or take precedence if critical
- overtake: plan an overtake using suitable loop
Only consider loop stations from this list: [Chandanpur, Masagram, Gurap, Saktigarh].

Return STRICT JSON with this schema and nothing else:
{
  "alternatives": [
    {
      "key": string,
      "title": string,
      "directive": "pass" | "halt" | "stable",
      "passThroughLine": "Up Main" | "Down Main" | "Reverse" | null,
      "loopStation": "Chandanpur" | "Masagram" | "Gurap" | "Saktigarh" | null,
      "loopId": number | null,
      "explanation": string
    }
  ]
}`;
}

export const handleAIPlan: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      return;
    }
    const prompt = buildPrompt(req.body || {});
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, topP: 0.9, topK: 40 },
    } as any;

    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const txt = await r.text();
      res.status(502).json({ error: "Gemini error", detail: txt });
      return;
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // try to extract JSON block
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed || !Array.isArray(parsed.alternatives)) {
      res.status(200).json({ alternatives: [] });
      return;
    }

    // Normalize fields
    const alts = parsed.alternatives.map((a: any, idx: number) => ({
      key: String(a.key ?? `alt-${idx + 1}`),
      title: String(a.title ?? "Alternative"),
      directive:
        a.directive === "halt" || a.directive === "stable"
          ? a.directive
          : "pass",
      passThroughLine: ["Up Main", "Down Main", "Reverse"].includes(
        a.passThroughLine,
      )
        ? a.passThroughLine
        : undefined,
      loopStation: ["Chandanpur", "Masagram", "Gurap", "Saktigarh"].includes(
        a.loopStation,
      )
        ? a.loopStation
        : undefined,
      loopId: typeof a.loopId === "number" ? a.loopId : undefined,
      explanation: String(a.explanation ?? ""),
    }));

    res.json({ alternatives: alts });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "AI plan failed", message: e?.message || String(e) });
  }
};
