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
      className={`w-full max-w-md mx-auto p-6 rounded-3xl backdrop-blur-md transition-all duration-300 text-center flex flex-col items-center justify-center space-y-6 select-none ${
        highlight
          ? 'bg-neutral-900/80 border-2 border-sky-500/40 shadow-xl shadow-sky-500/5'
          : 'bg-neutral-900/40 border border-neutral-800'
      }`}
    >
      {/* Icon Badge with soft gradient */}
      <div
        id={`slide-icon-badge-${slide.id}`}
        className={`w-20 h-20 rounded-2xl flex items-center justify-center p-[1px] ${
          highlight
            ? 'bg-gradient-to-tr from-sky-400 via-indigo-500 to-pink-500 shadow-lg shadow-sky-500/15'
            : 'bg-neutral-800 border border-neutral-700 shadow-md'
        }`}
      >
        <div className="w-full h-full bg-neutral-950 rounded-2xl flex items-center justify-center">
          <Icon
            className={`w-10 h-10 ${
              highlight ? 'text-sky-400' : 'text-neutral-400'
            }`}
          />
        </div>
      </div>

      {/* Slide Title with Display typography */}
      <div id={`slide-title-container-${slide.id}`} className="space-y-3">
        <h2
          id={`slide-title-${slide.id}`}
          className={`text-2xl font-black leading-tight tracking-tight ${
            highlight
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-400'
              : 'text-white'
          }`}
        >
          {title}
        </h2>
        {highlight && (
          <div
            id={`slide-sparkle-pill-${slide.id}`}
            className="inline-block bg-sky-500/10 px-3 py-1 rounded-full text-[10px] text-sky-400 uppercase tracking-widest font-bold"
          >
            قدرت Hexer Ai ✨
          </div>
        )}
      </div>

      {/* Slide Body with balanced negative space */}
      <p
        id={`slide-body-${slide.id}`}
        className="text-sm text-neutral-400 leading-relaxed font-medium px-2"
      >
        {body}
      </p>
    </div>
  );
};

export default SlideCard;
