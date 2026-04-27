"use client";
import { useState, useEffect } from 'react';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bayse_bookmarks');
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse bookmarks", e);
      }
    }
  }, []);

  // Save to localStorage whenever bookmarks change
  useEffect(() => {
    localStorage.setItem('bayse_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const toggleBookmark = (marketId: string) => {
    setBookmarks(prev => 
      prev.includes(marketId) 
        ? prev.filter(id => id !== marketId) 
        : [...prev, marketId]
    );
  };

  const isBookmarked = (marketId: string) => bookmarks.includes(marketId);

  return { bookmarks, toggleBookmark, isBookmarked };
}
