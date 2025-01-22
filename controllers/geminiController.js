const { GoogleGenerativeAI } = require("@google/generative-ai");
const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Initialize cache
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

// Profanity filter using regex
const profanityRegex = /asshole|bastard|hack|death|kill|murderbitch|bimbo|cunt|dick|douche|fag|fuck|goddamn|motherfucker|nigger|prick|pussy|shit|slut|twat|whore|wanker|cocksucker|cum|dickhead|fucking|jizz|kike|mothafucka|nigga|rape|skank|spic|tits|vagina|wop|chink|gook|redneck|raghead|sandnigger|wetback|fag|tranny|gypsy|nazi|abortion|anarchy|assassination|bomb|bribe|cartel|child abuse|crime|crack|drug|drugs|extortion|fraud|gun|hacker|illegal|meth|murder|narcotics|pedophile|porn|prostitute|robbery|sex trafficking|smuggle|theft|violence|weapons|antisemitism|bigotry|hate crime|holocaust denial|racism|sexism|terrorism|white supremacist|bullying|harassment|intimidation|self-harm|suicide/i;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Function to check for profanity
function containsProfanity(text) {
  return profanityRegex.test(text);
}

/**
 * Generate text based on a prompt
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
const generateText = async (req, res) => {
  const { prompt } = req.body;

  // Input validation
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({
      error: "Invalid prompt. Please provide a non-empty string.",
    });
  }

  // Content filtering
  if (containsProfanity(prompt)) {
    return res.status(400).json({
      error: "Prompt contains inappropriate content. Please revise your input.",
    });
  }

  // Check cache
  const cacheKey = `prompt:${prompt}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return res.json({ text: cachedResult });
  }

  try {
    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    // Cache the result
    cache.set(cacheKey, text);

    res.json({ text });
  } catch (error) {
    console.error(`Error generating text for prompt "${prompt}":`, error);

    if (error.message.includes("network")) {
      res.status(503).json({
        error: "Service is currently unavailable. Please try again later.",
      });
    } else if (error.message.includes("timeout")) {
      res.status(504).json({
        error: "Request timed out. Please try again.",
      });
    } else {
      res.status(500).json({
        error: "An unexpected error occurred. Please try again later.",
      });
    }
  }
};

/**
 * Generate auto-completion suggestions
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
const autoComplete = async (req, res) => {
  const { text } = req.body;

  // Input validation
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({
      error: "Invalid text. Please provide a non-empty string.",
    });
  }

  // Content filtering
  if (containsProfanity(text)) {
    return res.status(400).json({
      error: "Text contains inappropriate content. Please revise your input.",
    });
  }

  // Check cache
  const cacheKey = `autocomplete:${text}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return res.json({ suggestions: cachedResult });
  }

  try {
    const prompt = `Given the following text, provide 3 possible continuations, each no longer than 10 words:

Text: "${text}"

Continuations:
1.
2.
3.`;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    // Parse the response to extract the suggestions
    const suggestions = response.split('\n').filter(line => line.match(/^\d\./)).map(line => line.replace(/^\d\.\s*/, '').trim());

    // Cache the result
    cache.set(cacheKey, suggestions);

    res.json({ suggestions });
  } catch (error) {
    console.error(`Error generating auto-completion for text "${text}":`, error);

    if (error.message.includes("network")) {
      res.status(503).json({
        error: "Service is currently unavailable. Please try again later.",
      });
    } else if (error.message.includes("timeout")) {
      res.status(504).json({
        error: "Request timed out. Please try again.",
      });
    } else {
      res.status(500).json({
        error: "An unexpected error occurred. Please try again later.",
      });
    }
  }
};

module.exports = {
  generateText,
  autoComplete,
  limiter,
};