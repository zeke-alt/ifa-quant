"use client";
import { useState, useEffect } from 'react';

// Global store to sync bookmarks across all components using this hook
let globalBookmarks: string[] = [];
let listeners: ((bookmarks: string[]) => void)[] = [];
let isInitialized = false;

function notifyListeners() {
  for (const listener of listeners) {
    listener([...globalBookmarks]);
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    // Initial load from local storage
    if (!isInitialized && typeof window !== 'undefined') {
      const saved = localStorage.getItem('bayse_bookmarks');
      if (saved) {
        try {
          globalBookmarks = JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse bookmarks", e);
        }
      }
      isInitialized = true;
    }

    // Set initial state for this component
    setBookmarks([...globalBookmarks]);

    // Register listener
    listeners.push(setBookmarks);
    return () => {
      listeners = listeners.filter(l => l !== setBookmarks);
    };
  }, []);

  const toggleBookmark = (marketId: string) => {
    const isBookmarked = globalBookmarks.includes(marketId);
    
    if (isBookmarked) {
      globalBookmarks = globalBookmarks.filter(id => id !== marketId);
    } else {
      globalBookmarks = [...globalBookmarks, marketId];
    }
    
    localStorage.setItem('bayse_bookmarks', JSON.stringify(globalBookmarks));
    notifyListeners();
  };

  const isBookmarked = (marketId: string) => bookmarks.includes(marketId);

  return { bookmarks, toggleBookmark, isBookmarked };
}
