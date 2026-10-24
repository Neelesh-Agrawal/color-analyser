const ALLOWED_MODELS = new Set(["openai/gpt-oss-120b"]);
const MAX_TOKENS = 2000;
const MAX_MESSAGES = 10;
const MAX_CONTENT_LENGTH = 12000;

function isValidMessage(msg) {
  return (
    msg &&
    typeof msg === "object" &&
    (msg.role === "system" || msg.role === "user" || msg.role === "assistant") &&
    typeof msg.content === "string" &&
    msg.content.length > 0 &&
    msg.content.length <= MAX_CONTENT_LENGTH
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed" } });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: { message: "Server is missing GROQ_API_KEY. Add it in your deployment environment." }
    });
  }

  const { model, messages, max_tokens } = req.body || {};

  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: { message: "Unsupported model." } });
  }

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: { message: "Invalid messages payload." } });
  }

  if (!messages.every(isValidMessage)) {
    return res.status(400).json({ error: { message: "Each message must include a valid role and content." } });
  }

  const tokenLimit = typeof max_tokens === "number"
    ? Math.min(Math.max(1, Math.floor(max_tokens)), MAX_TOKENS)
    : 1500;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, reasoning_effort: 'low', max_tokens: tokenLimit })
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || "Upstream AI request failed.";
      return res.status(response.status).json({ error: { message } });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: { message: error.message || "Internal server error." } });
  }
}
