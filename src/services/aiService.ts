// SECURITY FIX: All Gemini API calls are now proxied through /api/ai/analyze
// on the Express server (server.ts). The API key NEVER reaches the browser.
// Previously: GoogleGenAI was instantiated here with process.env.GEMINI_API_KEY
// which Vite's `define` would inline into the client bundle.

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
  try {
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions: transactions.slice(0, 20), // limit payload
        pnlSummary: {
          winRate: pnl?.winRate,
          totalAssets: Object.keys(pnl?.tokens || {}).length,
        },
        missedGains,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('AI analysis error:', error);
    throw new Error('Failed to analyze wallet behavior. Please try again later.');
  }
}
