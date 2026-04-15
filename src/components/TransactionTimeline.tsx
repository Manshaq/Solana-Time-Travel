import * as React from "react";
import { useState } from "react";
import { 
  ExternalLink, 
  ArrowRight, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCcw,
  Filter
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown 
} from "lucide-react";

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

interface TransactionTimelineProps {
  transactions: Transaction[];
  loading: boolean;
  missedGains?: any[];
}

export function TransactionTimeline({ transactions, loading, missedGains = [] }: TransactionTimelineProps) {
  const [filter, setFilter] = useState<string>("all");

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    return tx.type === filter;
  });

  const getBadges = (tx: Transaction) => {
    if (tx.type !== "swap") return null;
    
    // "Good Entry": If it's a swap and the amount out seems significant
    const isGood = tx.amount_out > 10; 
    
    // "Bad Exit": If the token sold (token_in) is in the missedGains list
    const isBadExit = missedGains.some(g => g.token === tx.token_in);

    return (
      <div className="flex gap-2">
        {isGood && (
          <Badge variant="outline" className="rounded-none border-green-500/50 text-green-500 bg-green-500/5 text-[8px] uppercase px-1 h-4">
            <TrendingUp className="w-2 h-2 mr-1" /> Good Entry
          </Badge>
        )}
        {isBadExit && (
          <Badge variant="outline" className="rounded-none border-red-500/50 text-red-500 bg-red-500/5 text-[8px] uppercase px-1 h-4">
            <AlertCircle className="w-2 h-2 mr-1" /> Bad Exit
          </Badge>
        )}
      </div>
    );
  };

  const getActionText = (tx: Transaction) => {
    if (tx.type === "swap") {
      return (
        <div className="flex items-center gap-1">
          <span className="font-bold">Swap</span>
          <span className="opacity-60">{tx.symbol_in}</span>
          <ArrowRight className="w-3 h-3 opacity-40" />
          <span className="opacity-60">{tx.symbol_out}</span>
        </div>
      );
    }
    if (tx.type === "transfer") {
      if (tx.amount_in > 0) {
        return (
          <div className="flex items-center gap-1">
            <span className="font-bold">Sent</span>
            <span className="opacity-60">{tx.symbol_in || "SOL"}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1">
          <span className="font-bold">Received</span>
          <span className="opacity-60">{tx.symbol_out || "SOL"}</span>
        </div>
      );
    }
    if (tx.type === "nft") {
      return <span className="font-bold">NFT Interaction</span>;
    }
    return <span className="font-bold uppercase">{tx.type.replace(/_/g, ' ')}</span>;
  };

  const getIcon = (tx: Transaction) => {
    if (tx.type === "swap") return <RefreshCcw className="w-3 h-3 text-primary" />;
    if (tx.type === "transfer") {
      return tx.amount_in > 0 ? 
        <ArrowUpRight className="w-3 h-3 text-red-500" /> : 
        <ArrowDownLeft className="w-3 h-3 text-green-500" />;
    }
    return <Filter className="w-3 h-3 opacity-40" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-serif italic">Historical Timeline</h2>
        <Tabs value={filter} onValueChange={setFilter} className="w-auto">
          <TabsList className="bg-[var(--foreground)]/5 rounded-none border border-[var(--line)] h-8 p-0">
            <TabsTrigger value="all" className="text-[10px] uppercase tracking-widest rounded-none data-[state=active]:bg-[var(--foreground)] data-[state=active]:text-[var(--background)] h-full px-4">All</TabsTrigger>
            <TabsTrigger value="swap" className="text-[10px] uppercase tracking-widest rounded-none data-[state=active]:bg-[var(--foreground)] data-[state=active]:text-[var(--background)] h-full px-4">Swaps</TabsTrigger>
            <TabsTrigger value="transfer" className="text-[10px] uppercase tracking-widest rounded-none data-[state=active]:bg-[var(--foreground)] data-[state=active]:text-[var(--background)] h-full px-4">Transfers</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="border border-[var(--line)] overflow-hidden">
        <Table>
          <TableHeader className="bg-[var(--foreground)]/5">
            <TableRow className="hover:bg-transparent border-b border-[var(--line)]">
              <TableHead className="technical-header py-4">Time</TableHead>
              <TableHead className="technical-header py-4">Action</TableHead>
              <TableHead className="technical-header py-4">Amount</TableHead>
              <TableHead className="technical-header py-4 text-right">Signature</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i} className="border-b border-[var(--line)]/20">
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <TableRow key={tx.signature} className="hover-invert border-b border-[var(--line)]/20 group">
                  <TableCell className="technical-value text-[10px]">
                    {new Date(tx.timestamp * 1000).toLocaleString()}
                  </TableCell>
                  <TableCell className="technical-value text-[10px] max-w-[300px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {getIcon(tx)}
                        {getActionText(tx)}
                        {getBadges(tx)}
                      </div>
                      <span className="opacity-60 line-clamp-1 text-[9px]">{tx.description || "No description available"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="technical-value text-[10px]">
                    {tx.type === "swap" ? (
                      <div className="flex flex-col">
                        <span className="text-red-500">-{Number(tx.amount_in || 0).toFixed(4)} {tx.symbol_in}</span>
                        <span className="text-green-500">+{Number(tx.amount_out || 0).toFixed(4)} {tx.symbol_out}</span>
                      </div>
                    ) : (tx.amount_in || 0) > 0 ? (
                      <span className="text-red-500">-{Number(tx.amount_in || 0).toFixed(4)} {tx.symbol_in || "SOL"}</span>
                    ) : (
                      <span className="text-green-500">+{Number(tx.amount_out || 0).toFixed(4)} {tx.symbol_out || "SOL"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <a 
                      href={`https://solscan.io/tx/${tx.signature}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center technical-value text-[10px] opacity-40 hover:opacity-100"
                    >
                      {tx.signature.slice(0, 6)}...{tx.signature.slice(-4)}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 technical-value opacity-40">No transactions found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
