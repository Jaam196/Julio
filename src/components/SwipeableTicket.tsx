import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, PanInfo } from 'motion/react';

interface SwipeableTicketProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeLeftLabel?: string;
  swipeRightLabel?: string;
  swipeLeftIcon?: React.ReactNode;
  swipeRightIcon?: React.ReactNode;
  swipeLeftColorClass?: string;
  swipeRightColorClass?: string;
  key?: React.Key | string;
}

export default function SwipeableTicket({
  id,
  children,
  className = "",
  disabled = false,
  onSwipeLeft,
  onSwipeRight,
  swipeLeftLabel = "Eliminar",
  swipeRightLabel = "Activar",
  swipeLeftIcon,
  swipeRightIcon,
  swipeLeftColorClass = "bg-red-600/90",
  swipeRightColorClass = "bg-indigo-600/90",
}: SwipeableTicketProps) {
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);

  // Reset offset when id changes
  useEffect(() => {
    controls.start({ x: 0, opacity: 1 });
    setDragX(0);
  }, [id, controls]);

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;
    setDragX(info.offset.x);
  };

  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const threshold = containerWidth * 0.4; // 40% of width
    const xOffset = info.offset.x;

    if (xOffset > threshold && onSwipeRight) {
      // Swipe right success! Animate offscreen then trigger
      await controls.start({ x: containerWidth, opacity: 0, transition: { duration: 0.15 } });
      onSwipeRight();
    } else if (xOffset < -threshold && onSwipeLeft) {
      // Swipe left success! Animate offscreen then trigger
      await controls.start({ x: -containerWidth, opacity: 0, transition: { duration: 0.15 } });
      onSwipeLeft();
    } else {
      // Snap back to center
      controls.start({ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 350, damping: 25 } });
    }
    setDragX(0);
  };

  const containerWidth = containerRef.current?.offsetWidth || 300;
  const threshold = containerWidth * 0.4;
  const isRightTriggered = dragX > threshold;
  const isLeftTriggered = dragX < -threshold;

  return (
    <div 
      ref={containerRef} 
      className="relative overflow-hidden w-full rounded-xl select-none"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Background Panel - revealed on dragging right */}
      {dragX > 0 && onSwipeRight && (
        <div 
          className={`absolute inset-0 flex items-center pl-6 rounded-xl transition-all duration-150 ${
            isRightTriggered 
              ? `${swipeRightColorClass} text-white` 
              : 'bg-slate-900/60 text-slate-400 border border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3 select-none pointer-events-none">
            <div className={`transition-transform duration-200 ${isRightTriggered ? 'scale-125' : 'scale-100'}`}>
              {swipeRightIcon}
            </div>
            <span className={`font-sans font-bold text-xs uppercase tracking-wider transition-all duration-200 ${isRightTriggered ? 'translate-x-1' : ''}`}>
              {isRightTriggered ? `Suelte para ${swipeRightLabel.toLowerCase()}` : swipeRightLabel}
            </span>
          </div>
        </div>
      )}

      {/* Background Panel - revealed on dragging left */}
      {dragX < 0 && onSwipeLeft && (
        <div 
          className={`absolute inset-0 flex items-center justify-end pr-6 rounded-xl transition-all duration-150 ${
            isLeftTriggered 
              ? `${swipeLeftColorClass} text-white` 
              : 'bg-slate-900/60 text-slate-400 border border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3 select-none pointer-events-none">
            <span className={`font-sans font-bold text-xs uppercase tracking-wider transition-all duration-200 ${isLeftTriggered ? '-translate-x-1' : ''}`}>
              {isLeftTriggered ? `Suelte para ${swipeLeftLabel.toLowerCase()}` : swipeLeftLabel}
            </span>
            <div className={`transition-transform duration-200 ${isLeftTriggered ? 'scale-125' : 'scale-100'}`}>
              {swipeLeftIcon}
            </div>
          </div>
        </div>
      )}

      {/* Draggable Ticket Content */}
      <motion.div
        drag={disabled ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: onSwipeLeft ? -containerWidth : 0, right: onSwipeRight ? containerWidth : 0 }}
        dragElastic={0.4}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={controls}
        className={`relative z-10 w-full ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
