import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  hover = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  const Comp = hover ? motion.button : motion.div;
  return (
    <Comp
      type={hover ? "button" : undefined}
      onClick={onClick}
      whileHover={hover ? { y: -6, scale: 1.015 } : undefined}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`glass p-5 text-left ${hover ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </Comp>
  );
}
