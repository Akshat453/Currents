const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function addGroqExplanations(recommendations, input, logger) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!recommendations.length || !apiKey)
    return recommendations.map((item) => ({ ...item, explanationSource: "deterministic" }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.GROQ_TIMEOUT_MS || 4500));
  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        temperature: 0.1,
        max_completion_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You explain ranked EV charging recommendations. Never change, invent, or rerank the supplied values. Return only JSON as {"explanations":[{"id":string,"why":string}]}. Each why must be one concise sentence under 35 words and mention the most useful time/cost trade-off.'
          },
          {
            role: "user",
            content: JSON.stringify({
              priority: input.priority,
              batteryPercent: input.batteryPercent,
              recommendations: recommendations.map((item) => ({
                id: item.id,
                rank: item.rank,
                name: item.name,
                distanceKm: Number(item.distanceKm.toFixed(1)),
                drivingMinutes: Math.round(item.drivingMinutes),
                waitMinutes: Math.round(item.waitMinutes),
                chargingMinutes: Math.round(item.chargingMinutes),
                totalMinutes: Math.round(item.totalMinutes),
                estimatedCostInr: Math.round(item.estimatedCost),
                ratePerKwhInr: Number(item.rate.toFixed(1))
              }))
            })
          }
        ]
      })
    });
    if (!response.ok) throw new Error(`Groq returned ${response.status}`);
    const payload = await response.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
    const explanations = new Map(
      (parsed.explanations || [])
        .filter((item) => typeof item.id === "string" && typeof item.why === "string")
        .map((item) => [item.id, item.why.trim().slice(0, 280)])
    );
    return recommendations.map((item) => ({
      ...item,
      why: explanations.get(item.id) || item.why,
      explanationSource: explanations.has(item.id) ? "groq" : "deterministic"
    }));
  } catch (error) {
    logger?.warn({ err: error, provider: "groq" }, "Groq explanation fallback used");
    return recommendations.map((item) => ({ ...item, explanationSource: "deterministic" }));
  } finally {
    clearTimeout(timeout);
  }
}
