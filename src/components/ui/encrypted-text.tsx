"use client";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface EncryptedTextProps {
  text: string;
  revealDelayMs?: number;
  encryptedClassName?: string;
  revealedClassName?: string;
  className?: string;
}

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";

export const EncryptedText = ({
  text,
  revealDelayMs = 50,
  encryptedClassName,
  revealedClassName,
  className,
}: EncryptedTextProps) => {
  const [displayText, setDisplayText] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    let iteration = 0;
    let interval: any;

    const startEncryption = () => {
      interval = setInterval(() => {
        setDisplayText((prev) =>
          text
            .split("")
            .map((char, index) => {
              if (index < iteration) {
                return text[index];
              }
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("")
        );

        if (iteration >= text.length) {
          clearInterval(interval);
          setIsRevealed(true);
        }

        iteration += 1 / 3;
      }, revealDelayMs);
    };

    startEncryption();

    return () => clearInterval(interval);
  }, [text, revealDelayMs]);

  return (
    <span className={cn("font-mono", className)}>
      {displayText.split("").map((char, index) => {
        const isCharRevealed = isRevealed || index < Math.floor(displayText.length * (displayText === text ? 1 : 0.5)); // Simple heuristic for per-char styling if needed
        // Actually, the logic above in setInterval handles the reveal. 
        // Let's just check if the char matches the original text at that position.
        const isOriginal = char === text[index];

        return (
          <span
            key={index}
            className={cn(
              isOriginal ? revealedClassName : encryptedClassName,
              "transition-colors duration-100"
            )}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
};
