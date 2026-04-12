"use client";
import { cn } from "@/lib/utils";
import React from "react";
import { motion } from "motion/react";

export const BackgroundLines = ({
  children,
  className,
  svgOptions,
}: {
  children?: React.ReactNode;
  className?: string;
  svgOptions?: {
    duration?: number;
  };
}) => {
  return (
    <div className={cn("h-full w-full relative overflow-hidden", className)}>
      <SVG />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

const SVG = () => {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1440 900"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full opacity-[0.15] pointer-events-none"
      preserveAspectRatio="none"
    >
      <path
        d="M-100 100C200 100 400 300 720 300C1040 300 1240 100 1540 100"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M-100 200C200 200 400 400 720 400C1040 400 1240 200 1540 200"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M-100 300C200 300 400 500 720 500C1040 500 1240 300 1540 300"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M-100 400C200 400 400 600 720 600C1040 600 1240 400 1540 400"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M-100 500C200 500 400 700 720 700C1040 700 1240 500 1540 500"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M-100 600C200 600 400 800 720 800C1040 800 1240 600 1540 600"
        stroke="currentColor"
        strokeWidth="2"
      />
      
      {/* Animated paths */}
      <motion.path
        d="M-100 150C200 150 400 350 720 350C1040 350 1240 150 1540 150"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      <motion.path
        d="M-100 450C200 450 400 650 720 650C1040 650 1240 450 1540 450"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear", delay: 1 }}
      />
    </svg>
  );
};
