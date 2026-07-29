'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { CallLog } from '@/types';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';

export const CallHistory: React.FC = () => {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setIsLoading(true);
        const data = await fetchApi('/call/history');
        setLogs(data.logs || []);
      } catch (err) {
        console.error('Failed to load call history', err);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="w-full md:w-80 bg-slate-900/90 border-r border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Phone className="w-5 h-5 text-indigo-400" /> Call History
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading call history...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            No call logs recorded yet.
          </div>
        ) : (
          logs.map((log) => {
            const partner = log.receiverId || log.callerId;
            const isMissed = log.status === 'missed' || log.status === 'rejected';
            return (
              <div
                key={log._id}
                className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isMissed ? 'bg-rose-950/80 text-rose-400' : 'bg-emerald-950/80 text-emerald-400'}`}>
                    {isMissed ? <PhoneMissed className="w-5 h-5" /> : <PhoneIncoming className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{partner?.name || 'Voice Call'}</h4>
                    <p className="text-[11px] text-slate-400">
                      {formatDate(log.startTime)} at {formatTime(log.startTime)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${isMissed ? 'text-rose-400 bg-rose-950/60' : 'text-emerald-400 bg-emerald-950/60'}`}>
                    {log.status}
                  </span>
                  {log.duration > 0 && (
                    <p className="text-[10px] text-slate-500 font-mono mt-1">{log.duration}s</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
