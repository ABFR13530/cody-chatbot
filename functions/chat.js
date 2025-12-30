exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { messages, systemPrompt } = JSON.parse(event.body);
    
    // Convertir format Anthropic → Gemini
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // CORRECTION : Ajouter le systemPrompt comme premier message utilisateur
    if (systemPrompt && geminiMessages.length > 0) {
      geminiMessages[0].parts[0].text = systemPrompt + "\n\n" + geminiMessages[0].parts[0].text;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Erreur Gemini:', error);
      throw new Error(error);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response: text })
    };
    
  } catch (error) {
    console.error('Exception:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
