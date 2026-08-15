'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';

interface LinkPreviewData {
  title?: string;
  description?: string;
  image?: string;
  url: string;
  domain?: string;
}

interface LinkPreviewProps {
  url: string;
  isMe?: boolean;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url, isMe }) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const fetchPreview = async () => {
      try {
        // Use a CORS proxy / opengraph API to fetch metadata
        // Using jsonlink.io free API (no key needed)
        const apiUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();

        if (!cancelled) {
          const domain = new URL(url).hostname.replace('www.', '');
          setPreview({
            title: data.title || '',
            description: data.description || '',
            image: data.images?.[0] || '',
            url,
            domain,
          });
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPreview();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 p-3 rounded-xl bg-slate-900/40 border border-slate-700/40 animate-pulse">
        <div className="h-3 w-24 bg-slate-700 rounded mb-2"></div>
        <div className="h-2 w-40 bg-slate-700/60 rounded"></div>
      </div>
    );
  }

  if (error || !preview || (!preview.title && !preview.description)) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 block rounded-xl overflow-hidden border transition-all hover:opacity-90 ${
        isMe ? 'border-indigo-400/30 bg-indigo-950/40' : 'border-slate-700/50 bg-slate-900/60'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={preview.title || ''}
          className="w-full h-32 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="p-3 space-y-1">
        {preview.title && (
          <h4 className={`text-xs font-bold leading-tight line-clamp-2 ${
            isMe ? 'text-indigo-100' : 'text-white'
          }`}>{preview.title}</h4>
        )}
        {preview.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{preview.description}</p>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5">
          <Globe className="w-3 h-3" />
          <span>{preview.domain}</span>
          <ExternalLink className="w-3 h-3 ml-auto" />
        </div>
      </div>
    </a>
  );
};
