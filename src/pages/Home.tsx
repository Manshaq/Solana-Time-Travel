import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { Search, Clock, AlertCircle } from "lucide-react";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { PublicKey } from "@solana/web3.js";
import { BackgroundLines } from "@/components/ui/background-lines";
import { EncryptedText } from "@/components/ui/encrypted-text";

export default function Home() {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const words = `Input wallet address to travel back in time`;

  const validateSolanaAddress = (addr: string) => {
    try {
      new PublicKey(addr);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAddress = address.trim();
    
    if (!trimmedAddress) {
      setError("Please enter a wallet address");
      return;
    }

    if (validateSolanaAddress(trimmedAddress)) {
      setError(null);
      navigate(`/dashboard/${trimmedAddress}`);
    } else {
      setError("Invalid Solana wallet address format");
    }
  };

  return (
    <BackgroundLines className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm sm:max-w-md w-full space-y-6 sm:space-y-8 relative z-20"
      >
        <div className="text-center space-y-3 sm:space-y-2">
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border border-[var(--line)] flex items-center justify-center bg-[var(--background)]">
              <Clock className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight">
            <EncryptedText 
              text="Solana Time Machine" 
              revealDelayMs={40}
              encryptedClassName="opacity-40"
              revealedClassName="opacity-100"
            />
          </h1>
          <TextGenerateEffect 
            words={words} 
            className="text-[10px] sm:text-sm uppercase tracking-[0.2em] sm:tracking-widest opacity-60 font-normal"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Input
                value={address}
                onChange={(e) => {
                  const val = e.target.value;
                  setAddress(val);
                  if (error) setError(null);
                  
                  // Auto-submit if a valid address is pasted
                  const trimmed = val.trim();
                  if (trimmed.length >= 32 && trimmed.length <= 44 && validateSolanaAddress(trimmed)) {
                    navigate(`/dashboard/${trimmed}`);
                  }
                }}
                placeholder="Enter Wallet Address..."
                className={`h-12 sm:h-14 bg-[var(--background)]/80 backdrop-blur-sm border-[var(--line)] rounded-none font-mono text-xs sm:text-sm focus-visible:ring-0 focus-visible:ring-offset-0 ${
                  error ? "border-red-500" : ""
                }`}
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 opacity-40" />
            </div>
            
            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[9px] sm:text-[10px] text-red-500 uppercase tracking-widest font-mono flex items-center"
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 sm:h-14 brutalist-button active:scale-100"
          >
            Initiate Scan
          </Button>
        </form>
      </motion.div>
    </BackgroundLines>
  );
}
