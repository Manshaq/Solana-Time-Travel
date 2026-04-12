import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { motion } from "motion/react";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Wallet,
  Clock,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import { TransactionTimeline } from "@/components/TransactionTimeline";
import { calculatePnL, PnLSummary } from "@/lib/pnlEngine";
import { calculateMissedGains, MissedGain } from "@/lib/missedGainsEngine";
import { analyzeWalletBehavior, AIAnalysis } from "@/services/aiService";
import { PnLChart } from "@/components/PnLChart";
import { Brain, Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";

interface Transaction {
  signature: string;
  timestamp: number;
  type: "swap" | "transfer" | "nft" | "unknown";
  token_in: string | null;
  token_out: string | null;
  symbol_in?: string | null;
  symbol_out?: string | null;
  amount_in: number;
  amount_out: number;
  description?: string;
}

interface PortfolioItem {
  address: string;
  symbol: string;
  name: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
}

export default function Dashboard() {
  const { address } = useParams<{ address: string }>();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [visibleTransactions, setVisibleTransactions] = useState<Transaction[]>([]);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [pnl, setPnl] = useState<PnLSummary | null>(null);
  const [missedGains, setMissedGains] = useState<MissedGain[]>([]);
  const [aiReport, setAiReport] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      fetchData(address);
    }
  }, [address]);

  const fetchData = async (addr: string) => {
    setLoading(true);
    setError(null);
    setAiReport(null);
    try {
      const [txRes, portRes] = await Promise.all([
        api.getTransactions(addr),
        api.getPortfolio(addr)
      ]);
      
      const txData = txRes.data.data?.items || [];
      const portData = portRes.data.data?.items || [];
      
      setTransactions(txData);
      setVisibleTransactions(txData.slice(0, 10));
      setPortfolio(portData);
      const calculatedPnl = calculatePnL(txData, portData);
      setPnl(calculatedPnl);

      // Calculate Missed Gains
      const soldMints = Array.from(new Set(txData.filter((tx: any) => tx.type === "swap").map((tx: any) => tx.token_in)));
      if (soldMints.length > 0) {
        const priceRes = await api.getPrices(soldMints as string[]);
        const currentPrices = priceRes.data.data || {};
        setMissedGains(calculateMissedGains(txData, currentPrices));
      }

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch data. Check API keys.");
    } finally {
      setLoading(false);
    }
  };

  const handleAIAnalysis = async () => {
    if (!transactions.length || !pnl) return;
    setAnalyzing(true);
    try {
      const report = await analyzeWalletBehavior(transactions, pnl, missedGains);
      setAiReport(report);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const loadMore = () => {
    const newLimit = displayLimit + 10;
    setDisplayLimit(newLimit);
    setVisibleTransactions(transactions.slice(0, newLimit));
  };

  const totalValue = portfolio.reduce((acc, item) => acc + item.valueUsd, 0);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-4">
        <h2 className="text-2xl font-serif italic">System Error</h2>
        <p className="text-sm font-mono opacity-60 max-w-md text-center">{error}</p>
        <Link to="/" className="text-xs uppercase tracking-widest underline">Return to Base</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 md:pb-8 border-b border-[var(--line)]">
        <div className="space-y-1 w-full md:w-auto">
          <Link to="/" className="flex items-center text-[9px] sm:text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity mb-2">
            <ArrowLeft className="w-3 h-3 mr-1" /> Back to Search
          </Link>
          <h1 className="text-2xl sm:text-3xl font-serif italic">Wallet Analysis</h1>
          <p className="text-[10px] sm:text-xs font-mono opacity-60 truncate max-w-full md:max-w-none">{address}</p>
        </div>
        <div className="flex gap-4 sm:gap-8 w-full md:w-auto justify-between md:justify-end">
          <div className="text-left md:text-right">
            <p className="technical-header">Win Rate</p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-green-500">{loading ? <Skeleton className="h-6 w-16 ml-auto" /> : `${pnl?.winRate.toFixed(1)}%`}</p>
          </div>
          <div className="text-right">
            <p className="technical-header">Net Worth (USD)</p>
            <p className="text-xl sm:text-2xl font-mono font-bold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 technical-grid">
        <div className="technical-cell space-y-1 sm:space-y-2">
          <div className="flex justify-between items-center">
            <p className="technical-header">Activity Level</p>
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 opacity-40" />
          </div>
          <p className="technical-value text-lg sm:text-xl">{loading ? <Skeleton className="h-6 w-20" /> : transactions.length}</p>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-widest opacity-40">Parsed Transactions</p>
        </div>
        <div className="technical-cell space-y-1 sm:space-y-2">
          <div className="flex justify-between items-center">
            <p className="technical-header">Portfolio Health</p>
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 opacity-60" />
          </div>
          <p className="technical-value text-lg sm:text-xl">{loading ? <Skeleton className="h-6 w-20" /> : `${Object.keys(pnl?.tokens || {}).length} Assets`}</p>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-widest opacity-40">Active Positions</p>
        </div>
        <div className="technical-cell space-y-1 sm:space-y-2">
          <div className="flex justify-between items-center">
            <p className="technical-header">Fumbles Detected</p>
            <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 opacity-60" />
          </div>
          <p className="technical-value text-lg sm:text-xl">{loading ? <Skeleton className="h-6 w-20" /> : missedGains.length}</p>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-widest opacity-40">Significant Missed Gains</p>
        </div>
      </div>

      {/* PnL Chart Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-serif italic">Performance Analytics</h2>
        <PnLChart transactions={transactions} loading={loading} />
      </div>

      {/* AI Analysis Section */}
      <div className="technical-cell border-primary/20 bg-primary/5 p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-serif italic">AI Behavioral Analysis</h2>
          </div>
          {!aiReport && !analyzing && (
            <Button 
              onClick={handleAIAnalysis}
              disabled={loading}
              className="brutalist-button h-10 px-4 active:scale-100"
            >
              <Sparkles className="w-3 h-3 mr-2" /> Generate Report
            </Button>
          )}
        </div>

        {analyzing ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <p className="text-[10px] uppercase tracking-widest opacity-40 animate-pulse text-center">Gemini is analyzing historical patterns...</p>
          </div>
        ) : aiReport ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="technical-header flex items-center text-green-500">
                  <ShieldCheck className="w-3 h-3 mr-2" /> Core Strengths
                </p>
                <ul className="space-y-2">
                  {aiReport.strengths.map((s, i) => (
                    <li key={i} className="text-xs font-mono opacity-80 flex items-start">
                      <span className="mr-2 opacity-40">—</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <p className="technical-header flex items-center text-red-500">
                  <ShieldAlert className="w-3 h-3 mr-2" /> Strategic Weaknesses
                </p>
                <ul className="space-y-2">
                  {aiReport.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs font-mono opacity-80 flex items-start">
                      <span className="mr-2 opacity-40">—</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-3 bg-[var(--foreground)]/5 p-4 border border-[var(--line)]">
              <p className="technical-header">Behavioral Summary</p>
              <p className="text-sm font-serif italic leading-relaxed opacity-90">
                "{aiReport.summary}"
              </p>
              <div className="pt-4 flex justify-end">
                <span className="text-[8px] uppercase tracking-widest opacity-40 font-mono">Analysis by Gemini 3.1 Pro</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <p className="text-xs font-mono opacity-40 text-center py-4">
            Click "Generate Report" to let AI analyze this wallet's trading personality.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Transaction History */}
        <div className="lg:col-span-2 space-y-8">
          <TransactionTimeline 
            transactions={visibleTransactions} 
            loading={loading} 
            missedGains={missedGains}
          />
          
          {transactions.length > displayLimit && !loading && (
            <div className="flex justify-center pt-4">
              <Button 
                onClick={loadMore}
                className="brutalist-button h-10 px-6 active:scale-100"
              >
                Load More History
              </Button>
            </div>
          )}
          
          {/* Missed Gains Section */}
          {!loading && missedGains.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-serif italic text-red-500">The "Fumbles" (Missed Gains)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {missedGains.map((gain) => (
                  <div key={gain.token} className="technical-cell border-red-500/20 bg-red-500/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="technical-value font-bold">{gain.symbol}</p>
                        <p className="text-[10px] uppercase tracking-widest opacity-40">Sold too early</p>
                      </div>
                      <Badge variant="outline" className="rounded-none border-red-500 text-red-500 text-[8px] uppercase">
                        +{gain.percentage.toFixed(0)}% Since Sell
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-red-500/10">
                      <div>
                        <p className="text-[9px] uppercase opacity-40">Sell Price</p>
                        <p className="text-xs font-mono">${gain.sell_price.toLocaleString(undefined, { maximumSignificantDigits: 4 })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase opacity-40">Current Price</p>
                        <p className="text-xs font-mono">${gain.current_price.toLocaleString(undefined, { maximumSignificantDigits: 4 })}</p>
                      </div>
                    </div>
                    <div className="pt-2">
                      <p className="text-[9px] uppercase opacity-40">Potential Profit Missed</p>
                      <p className="text-lg font-mono font-bold text-red-500">
                        ${gain.missed_profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* Portfolio Sidebar */}
        <div className="space-y-4">
          <h2 className="text-xl font-serif italic">Current Holdings</h2>
          <div className="space-y-0 technical-grid">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="technical-cell">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))
            ) : portfolio.length > 0 ? (
              portfolio.map((item) => (
                <div key={item.address} className="technical-cell hover-invert group">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="technical-value font-bold">{item.symbol}</p>
                      <p className="text-[10px] uppercase tracking-widest opacity-40 group-hover:opacity-100">{item.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="technical-value">${item.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      <p className="text-[10px] font-mono opacity-40 group-hover:opacity-100">
                        {item.balance.toLocaleString(undefined, { maximumSignificantDigits: 6 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="technical-cell text-center py-8 technical-value opacity-40">Empty Portfolio</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-12 border-t border-[var(--line)] flex justify-between text-[10px] uppercase tracking-widest font-mono opacity-40">
        <span>Data Source: Birdeye API</span>
        <span>Status: Synced</span>
        <span>{new Date().toISOString()}</span>
      </footer>
    </div>
  );
}
