interface UseOpenAIReturn {
  textToSpeech: (text: string, voice?: string) => Promise<ArrayBuffer>;
}

export function useOpenAI(): UseOpenAIReturn {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    console.warn(
      "OpenAI API key not found. TTS notifications will be skipped. Set VITE_OPENAI_API_KEY to enable.",
    );
  }

  async function textToSpeech(
    text: string,
    voice: string = "alloy",
  ): Promise<ArrayBuffer> {
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${error || response.statusText}`,
      );
    }

    return response.arrayBuffer();
  }

  return { textToSpeech };
}
