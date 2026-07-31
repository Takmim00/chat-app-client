'use client';

import React, { useState, useEffect } from 'react';
import { RingtonePreset, playRingtonePreview } from '@/hooks/useCallRingtone';
import { Bell, Volume2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface RingtoneSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RingtoneSelectorModal: React.FC<RingtoneSelectorModalProps> = ({ isOpen, onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState<RingtonePreset>('aurora');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = (localStorage.getItem('RINGTONE_PRESET') as RingtonePreset) || 'aurora';
      setSelectedPreset(saved);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const presets: { id: RingtonePreset; title: string; desc: string }[] = [
    { id: 'aurora', title: 'Aurora Melody (Default)', desc: 'Messenger-style dual harmonic melody' },
    { id: 'chime', title: 'Digital Chime', desc: 'Soft pleasant electronic chime' },
    { id: 'retro', title: 'Classic Retro Ring', desc: 'Traditional phone bell tone' },
  ];

  const handleSelect = (id: RingtonePreset) => {
    setSelectedPreset(id);
    playRingtonePreview(id);
  };

  const handleSave = () => {
    localStorage.setItem('RINGTONE_PRESET', selectedPreset);
    toast.success('Ringtone saved successfully!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Call Ringtone Settings</h3>
              <p className="text-xs text-slate-400">Choose incoming call ringtone</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {presets.map((p) => {
            const isSelected = selectedPreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>
                  <h4 className="font-semibold text-sm">{p.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playRingtonePreview(p.id);
                    }}
                    className="p-2 bg-slate-700/80 hover:bg-slate-600 text-indigo-300 rounded-xl"
                    title="Preview Tone"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  {isSelected && <Check className="w-5 h-5 text-indigo-400 font-bold" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30">
            Save Ringtone
          </button>
        </div>
      </div>
    </div>
  );
};
