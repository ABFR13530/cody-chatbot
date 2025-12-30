exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Vérifier la clé API
  if (!process.env.GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'GEMINI_API_KEY non configurée dans Netlify' })
    };
  }

  console.log('Clé API présente:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');

  try {
    const { messages, systemPrompt } = JSON.parse(event.body);
    
    // Convertir format
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Ajouter system prompt au premier message
    if (systemPrompt && geminiMessages.length > 0) {
      geminiMessages[0].parts[0].text = systemPrompt + "\n\n" + geminiMessages[0].parts[0].text;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    console.log('Appel API Gemini...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000
        }
      })
    });

    console.log('Status:', response.status);
    
    const responseText = await response.text();
    console.log('Réponse brute:', responseText);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Erreur ${response.status}`,
          details: responseText
        })
      };
    }

    const data = JSON.parse(responseText);
    const text = data.candidates[0].content.parts[0].text;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response: text })
    };
    
  } catch (error) {
    console.error('Exception complète:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack
      })
    };
  }
};
