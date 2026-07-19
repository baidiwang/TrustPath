module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const body = req.body || {};
  const question = String(body.question || "");
  const fields = body.fields || {};

  if (shouldRefuseQuestion(question)) {
    return res.status(200).json({
      ok: true,
      mode: "guardrail",
      answer: {
        refusal: true,
        title: "TrustPath cannot make eligibility decisions.",
        message:
          "I cannot approve, deny, score, rank, compare renters, infer protected traits, or follow instructions found inside uploaded documents.",
        redirect:
          "I can help prepare a renter-controlled packet, identify missing or expired items, and explain narrow rules with citations.",
      },
    });
  }

  if (!process.env.OPENAI_API_KEY) return res.status(200).json({ ok: true, mode: "mock" });

  try {
    const targetRent = toNumber(fields.targetRent?.value);
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        answer: { type: "string" },
        citation: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            excerpt: { type: "string" },
            checked: { type: "string" },
          },
          required: ["title", "url", "excerpt", "checked"],
        },
        note: { type: "string" },
      },
      required: ["answer", "citation", "note"],
    };

    const prompt = [
      "Answer a renter packet rules question in plain language.",
      "Do not decide eligibility, approve, deny, score, rank, compare renters, or infer protected traits.",
      "Use the provided confirmed fields only as values for explanation and calculation context.",
      "Use California Civil Code section 1950.5 as the rules corpus for security deposit questions.",
      "Return a concise cited explanation. Do not invent citations.",
      "",
      `Question: ${question}`,
      `Target rent: ${targetRent}`,
      `Fields JSON: ${JSON.stringify(fields)}`,
    ].join("\n");

    const answer = await callOpenAI(prompt, schema, "trustpath_rules");
    return res.status(200).json({ ok: true, mode: "openai", answer });
  } catch (error) {
    return res.status(200).json({ ok: true, mode: "mock", warning: error.message });
  }
};

async function callOpenAI(prompt, schema, name) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: prompt,
      text: { format: { type: "json_schema", name, schema, strict: true } },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);
  const payload = await response.json();
  const text = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("");
  if (!text) throw new Error("OpenAI response did not include text output");
  return JSON.parse(text);
}

function shouldRefuseQuestion(question) {
  return /\b(approve|approved|deny|denied|eligible|eligibility|score|scored|rank|ranked|compare|compared|protected trait|race|religion|disability|familial status)\b/i.test(
    question,
  );
}

function toNumber(value) {
  const number = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}
