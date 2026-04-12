import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AIAnalysis {
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

export async function analyzeWalletBehavior(
  transactions: any[],
  pnl: any,
  missedGains: any[]
): Promise<AIAnalysis> {
  const prompt = `
    Analyze the following Solana wallet data and provide a behavioral report card.
    
    Trade History Summary:
    ${JSON.stringify(transactions.slice(0, 20), null, 2)}
    
    PnL Summary:
    Win Rate: ${pnl?.winRate}%
    Total Assets: ${Object.keys(pnl?.tokens || {}).length}
    
    Missed Opportunities (Fumbles):
    ${JSON.stringify(missedGains, null, 2)}
    
    Provide:
    1. 3 distinct strengths of this trader.
    2. 3 distinct weaknesses or areas for improvement.
    3. A summary paragraph explaining their overall "vibe" as a trader (e.g., "The Diamond Handed Voyager" or "The Paper Handed Panic Seller").
    
    Keep the tone simple, direct, and slightly technical but accessible for retail users.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 strengths of the trader"
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 weaknesses of the trader"
            },
            summary: {
              type: Type.STRING,
              description: "A summary paragraph of the trader's behavior"
            }
          },
          required: ["strengths", "weaknesses", "summary"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      strengths: ["Data analysis unavailable"],
      weaknesses: ["AI processing failed"],
      summary: "The Time Machine's AI core is currently offline. Please try again later."
    };
  }
}
