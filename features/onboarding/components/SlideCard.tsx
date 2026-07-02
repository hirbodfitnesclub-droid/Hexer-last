import React from 'react';
import { OnboardingSlide } from '../data/slides';

interface SlideCardProps {
  slide: OnboardingSlide;
}

export const SlideCard: React.FC<SlideCardProps> = ({ slide }) => {
  const { Icon, title, body, highlight } = slide;

  return (
    <div
      id={`slide-card-${slide.id}`}
      className={`w-full max-w-md mx-auto p-6 rounded-3xl backdrop-blur-xl transition-all duration-300 text-center flex flex-col items-center justify-center space-y-6 select-none bg-[var(--bg-card)] border border-[var(--border-subtle)] ${
        highlight
          ? 'shadow-xl ring-2 ring-primary/20'
          : 'shadow-md'
      }`}
    >
      {/* Icon Badge with soft gradient */}
      <div
        id={`slide-icon-badge-${slide.id}`}
        className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
          highlight
            ? 'bg-primary/15 border border-primary/30 shadow-lg shadow-primary/10'
            : 'bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] shadow-md'
        }`}
      >
        <Icon
          className={`w-10 h-10 ${
            highlight ? 'text-primary' : 'text-[var(--text-muted)]'
          }`}
        />
      </div>

      {/* Slide Title with Display typography */}
      <div id={`slide-title-container-${slide.id}`} className="space-y-3">
        <h2
          id={`slide-title-${slide.id}`}
          className={`text-2xl font-black leading-tight tracking-tight ${
            highlight
              ? 'text-primary'
              : 'text-[var(--text-main)]'
          }`}
        >
          {title}
        </h2>
        {highlight && (
          <div
            id={`slide-sparkle-pill-${slide.id}`}
            className="inline-block bg-primary/10 px-3 py-1 rounded-full text-[10px] text-primary uppercase tracking-widest font-bold"
          >
            قدرت Hexer Ai ✨
          </div>
        )}
      </div>

      {/* Slide Body with balanced negative space */}
      <p
        id={`slide-body-${slide.id}`}
        className="text-sm text-[var(--text-muted)] leading-relaxed font-medium px-2"
      >
        {body}
      </p>
    </div>
  );
};

export default SlideCard;
