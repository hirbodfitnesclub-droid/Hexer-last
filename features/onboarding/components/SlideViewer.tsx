import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ONBOARDING_SLIDES } from '../data/slides';
import SlideCard from './SlideCard';
import { ChevronRightIcon, ChevronLeftIcon } from '../../../components/icons';

interface SlideViewerProps {
  onFinish: () => void;
  onSkip: () => void;
}

export const SlideViewer: React.FC<SlideViewerProps> = ({ onFinish, onSkip }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    } else {
      onFinish();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const currentSlide = ONBOARDING_SLIDES[currentIndex];

  // Motion animation parameters for beautiful and fluid walkthrough transitions
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 }
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  };

  return (
    <div
      id="slide-viewer-container"
      className="w-full flex-1 flex flex-col justify-between"
      dir="rtl"
    >
      {/* Header controls: constant Skip link */}
      <div
        id="slide-viewer-header"
        className="w-full flex justify-between items-center px-2 py-4"
      >
        <span id="slide-index-counter" className="text-xs font-bold text-[var(--text-muted)] font-mono">
          {currentIndex + 1} / {ONBOARDING_SLIDES.length}
        </span>
        <button
          id="slide-skip-btn"
          type="button"
          onClick={onSkip}
          className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] px-3 py-1.5 rounded-full hover:bg-[var(--nav-hover-bg)] transition-colors duration-200 min-h-[44px] flex items-center justify-center"
        >
          پرش به برنامه
        </button>
      </div>

      {/* Slide Core Visual with AnimatePresence */}
      <div
        id="slide-main-frame"
        className="relative flex-1 flex items-center justify-center overflow-hidden min-h-[360px] py-4"
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            id={`slide-anim-container-${currentIndex}`}
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute w-full px-1"
          >
            <SlideCard slide={currentSlide} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Dots Indicator */}
      <div
        id="slide-progressbar-dots"
        className="flex justify-center items-center gap-2 py-6"
      >
        {ONBOARDING_SLIDES.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <button
              id={`progress-dot-${slide.id}`}
              key={slide.id}
              onClick={() => {
                setDirection(index > currentIndex ? 1 : -1);
                setCurrentIndex(index);
              }}
              className={`h-2.5 rounded-full transition-all duration-300 min-w-2.5 min-h-[44px] flex items-center justify-center group`}
              title={slide.title}
            >
              <span
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-6 bg-primary shadow-sm shadow-primary/30'
                    : 'w-2.5 bg-black/10 dark:bg-white/10 group-hover:bg-black/20 dark:group-hover:bg-white/20'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Footer Navigation Buttons (Minimum 44px touch targets) */}
      <div
        id="slide-viewer-navigation"
        className="w-full flex items-center gap-3 pt-2 pb-6"
      >
        {/* Previous Button (Only visible past first slide) */}
        {currentIndex > 0 ? (
          <button
            id="slide-nav-prev-btn"
            type="button"
            onClick={handlePrev}
            className="flex-1 border border-[var(--border-subtle)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold h-12 rounded-2xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 text-sm"
          >
            {/* Chevron Right (points to the right to go/return to start in RTL) */}
            <ChevronRightIcon className="w-4 h-4" />
            <span>قبلی</span>
          </button>
        ) : (
          <div className="flex-1" />
        )}

        {/* Next / Getting Started Button */}
        <button
          id="slide-nav-next-btn"
          type="button"
          onClick={handleNext}
          className={`font-black h-12 rounded-2xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 text-sm ${
            currentIndex === ONBOARDING_SLIDES.length - 1
              ? 'flex-[2] bg-primary text-[var(--text-on-primary)] shadow-lg shadow-primary/10 hover:opacity-90'
              : 'flex-1 bg-primary text-[var(--text-on-primary)] shadow-md hover:opacity-90'
          }`}
        >
          {currentIndex === ONBOARDING_SLIDES.length - 1 ? (
            <>
              <span>وقتشه مغزت رو خالی کنی! 🚀</span>
            </>
          ) : (
            <>
              <span>بعدی</span>
              {/* Chevron Left (points to the left to advance/go forward in RTL) */}
              <ChevronLeftIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SlideViewer;
