'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      // Only show if scrolled down a bit
      if (window.scrollY > 300) {
        setIsVisible(true);
        
        // Clear any existing timeout
        clearTimeout(scrollTimeout);
        
        // Hide the button 0.4 seconds after scrolling STOPS
        scrollTimeout = setTimeout(() => {
          setIsVisible(false);
        }, 400);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-[999999] p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl transition-all duration-500 hover:-translate-y-1 active:scale-95 flex items-center justify-center group ${
        isVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-10 pointer-events-none'
      }`}
      aria-label="Scroll to Top"
      title="Scroll to Top"
    >
      <ArrowUp className="w-5 h-5 group-hover:animate-bounce" />
    </button>
  );
}
