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
      whileHover={hover ? { y: -5, scale: 1.012 } : undefined}
      whileTap={hover ? { scale: 0.985 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.7 }}
      className={`glass p-5 text-left ${hover ? "cursor-pointer will-change-transform" : ""} ${className}`}
    >
      {children}
    </Comp>
  );
}
