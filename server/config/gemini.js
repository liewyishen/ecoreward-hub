const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

// Initialize Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Analyze waste item from image using Gemini AI
 * @param {string} imagePath - Path to the uploaded image file
 * @returns {Promise<Object>} Analysis result with type, confidence, tips
 */
async function analyzeWasteItem(imagePath) {
  try {
    // Read image file as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Prepare prompt for Gemini
    const prompt = `Analyze this waste/recyclable item image and provide a detailed classification.

Return your response as valid JSON with this exact structure:
{
  "type": "Plastic|Metal|Glass|Paper|Organic|E-waste|Non-recyclable",
  "subtype": "specific item name (e.g., PET Bottle, Aluminum Can, etc.)",
  "confidence": 0.95,
  "recyclable": true,
  "tips": "Brief recycling instructions or disposal advice (2-3 sentences)"
}

Rules:
- type must be one of: Plastic, Metal, Glass, Paper, Organic, E-waste, Non-recyclable
- confidence should be between 0.0 and 1.0 (how certain you are)
- recyclable: true if item can be recycled, false otherwise
- tips should be practical and specific to this item type
- Return ONLY valid JSON, no markdown formatting or extra text`;

    // Call Gemini API with image
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
    });

    // Extract text from response
    const responseText = response.text;

    // Parse JSON from response (handle potential markdown formatting)
    let cleanedResponse = responseText.trim();

    // Remove markdown code blocks if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    }

    // Parse JSON
    const result = JSON.parse(cleanedResponse);

    // Validate result structure
    if (!result.type || !result.subtype || result.confidence === undefined) {
      throw new Error('Invalid response structure from Gemini');
    }

    // Ensure confidence is in valid range
    result.confidence = Math.max(0, Math.min(1, result.confidence));

    return {
      success: true,
      data: result,
      raw_response: cleanedResponse, // Use cleaned JSON instead of original response
    };
  } catch (error) {
    console.error('Gemini API Error:', error);

    // Return fallback response on error
    return {
      success: false,
      error: error.message,
      data: {
        type: 'Unknown',
        subtype: 'Unidentified Item',
        confidence: 0.0,
        recyclable: false,
        tips: 'Unable to identify this item. Please try with a clearer image or different angle.',
      },
    };
  }
}

module.exports = { analyzeWasteItem };
