const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    return json({ error: "OPENAI_API_KEY is not set" }, 500);
  }

  try {
    const body = await request.json();
    const dogName = cleanText(body.dog_name || "ポチ").slice(0, 24) || "ポチ";
    const userText = cleanText(body.text).slice(0, 700);
    const history = normalizeHistory(body.history);

    if (!userText) {
      return json({ error: "text is required" }, 400);
    }

    const input = [
      history.length ? "直近の会話:" : "",
      ...history.map((message) => `${message.role === "assistant" ? "スマホ犬" : "ユーザー"}: ${message.content}`),
      `ユーザー: ${userText}`,
      "スマホ犬:",
    ].filter(Boolean).join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        instructions: [
          `あなたはスマホ犬「${dogName}」です。`,
          "ユーザーと自然に短く会話してください。",
          "返答は日本語で、1文から2文にしてください。",
          "犬らしく親しみやすいが、幼すぎない口調にしてください。",
          "重要: すべての返答の最後の語尾は必ず「ワン」にしてください。",
          "句点や感嘆符の後ろではなく、最後の文字列が必ず「ワン」になるようにしてください。",
        ].join("\n"),
        input,
        max_output_tokens: 120,
        temperature: 0.8,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      return json({ error: "OpenAI response failed", detail: text }, response.status);
    }

    const data = JSON.parse(text);
    const reply = ensureWanEnding(extractOutputText(data));
    return json({ reply });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: cleanText(item?.content).slice(0, 360),
    }))
    .filter((item) => item.content)
    .slice(-8);
}

function extractOutputText(data: any): string {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function cleanText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function ensureWanEnding(reply: string): string {
  const trimmed = cleanText(reply).replace(/[。.!！?？]+$/g, "");
  if (!trimmed) return "聞こえたワン";
  return trimmed.endsWith("ワン") ? trimmed : `${trimmed}ワン`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
