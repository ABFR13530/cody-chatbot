/**
 * Fonction Netlify Serverless - API Proxy pour Anthropic Claude
 * 
 * Cette fonction agit comme un proxy sécurisé entre le frontend et l'API Anthropic.
 * Elle garde la clé API secrète côté serveur.
 * 
 * Variables d'environnement requises:
 * - ANTHROPIC_API_KEY: Votre clé API Anthropic
 */

exports.handler = async (event, context) => {
  // ============================================
  // GESTION CORS
  // ============================================
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gestion des requêtes OPTIONS (preflight CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Seules les requêtes POST sont autorisées
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' })
    };
  }

  // ============================================
  // VALIDATION & PARSING
  // ============================================
  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Corps de requête JSON invalide' })
    };
  }

  const { messages, systemPrompt } = requestBody;

  // Validation des paramètres
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Le paramètre "messages" est requis et doit être un tableau non vide' })
    };
  }

  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Le paramètre "systemPrompt" est requis et doit être une chaîne de caractères' })
    };
  }

  // ============================================
  // VÉRIFICATION CLÉ API
  // ============================================
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY non configurée');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Clé API non configurée. Contactez l\'administrateur.' 
      })
    };
  }

  // ============================================
  // APPEL API ANTHROPIC
  // ============================================
  try {
    console.log(`📨 Appel API Anthropic - ${messages.length} messages`);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', // Claude Sonnet 4.5
        max_tokens: 2000,
        temperature: 0.3, // Cohérence et précision
        system: systemPrompt,
        messages: messages
      })
    });

    // Gestion des erreurs HTTP
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Erreur API Anthropic:', response.status, errorData);
      
      // Messages d'erreur personnalisés selon le code HTTP
      let errorMessage = 'Erreur lors de la communication avec l\'API';
      
      if (response.status === 401) {
        errorMessage = 'Clé API invalide';
      } else if (response.status === 429) {
        errorMessage = 'Limite de requêtes atteinte. Réessayez dans quelques instants.';
      } else if (response.status === 500) {
        errorMessage = 'Erreur serveur Anthropic. Réessayez plus tard.';
      }
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: errorMessage,
          details: errorData
        })
      };
    }

    // Parse de la réponse
    const data = await response.json();
    
    // Extraction de la réponse textuelle
    const assistantResponse = data.content && data.content[0] && data.content[0].text
      ? data.content[0].text
      : 'Désolé, je n\'ai pas pu générer de réponse.';

    console.log(`✅ Réponse générée (${assistantResponse.length} caractères)`);

    // Retour de la réponse au client
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        response: assistantResponse,
        model: data.model,
        usage: data.usage // Informations sur l'utilisation (tokens)
      })
    };

  } catch (error) {
    // Erreurs réseau ou autres erreurs inattendues
    console.error('❌ Erreur inattendue:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur serveur interne',
        message: error.message 
      })
    };
  }
};