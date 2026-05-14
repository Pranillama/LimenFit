'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function MotionSection({ children, className, delay = 0 }: Props) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  );
}
