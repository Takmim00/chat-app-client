'use client';

import React, { useState, useCallback, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { useChatStore } from '@/store/useChatStore';
import { useGroupStore } from '@/store/useGroupStore';
import { Message } from '@/types';
import { Search, X, Loader2, MessageSquare } from 'lucide-react';
import { formatTime, formatDate } from '@/lib/utils';

interface SearchMessagesProps {
  onClose: () => void;
}

export const SearchMessages: React.FC<SearchMessagesProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { activeChatPartner } = useChatStore();
  const { activeGroup } = useGroupStore();
  const debounceRef = useRef<any>(null);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      let url = `/message/search?query=${encodeURIComponent(searchQuery)}`;
      if (activeChatPartner) {
        url += `&partnerId=${activeChatPartner._id}`;
      } else if (activeGroup) {
        url += `&groupId=${activeGroup._id}`;
      }
      const data = await fetchApi(url);
      setResults(data.messages || []);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [activeChatPartner, activeGroup]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(value), 400);
  };

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-indigo-500/40 text-white rounded px-0.5">{part}</mark>
      ) : part
    );
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800 p-3 space-y-3 animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search in conversation..."
            autoFocus
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700/60 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl">
          <X className="w-5 h-5" />
        </button>
      </div>

      {isSearching && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <div className="text-center py-4 text-xs text-slate-500">
          No messages found for "{query}"
        </div>
      )}

      {results.length > 0 && (
        <div className="max-h-60 overflow-y-auto space-y-1">
          {results.map((msg) => {
            const sender = typeof msg.senderId === 'object' ? msg.senderId : null;
            return (
              <div
                key={msg._id}
                className="p-2.5 bg-slate-800/60 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-indigo-400">
                    {sender?.name || 'Unknown'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatDate(msg.createdAt)} {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2">
                  {highlightText(msg.content, query)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
