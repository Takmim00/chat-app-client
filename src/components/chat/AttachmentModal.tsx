'use client';

import React, { useState } from 'react';
import { uploadToCloudinary } from '@/lib/api';
import { X, Upload, File, Image, Video, Music, FileArchive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAttachment: (attachment: { url: string; name: string; size: number; type: string }) => void;
}

export const AttachmentModal: React.FC<AttachmentModalProps> = ({
  isOpen,
  onClose,
  onSendAttachment,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadToCloudinary(file);
      onSendAttachment(result);
      toast.success('File uploaded successfully!');
      setFile(null);
      onClose();
    } catch (err: any) {
      toast.error('Upload failed. Please try again.');
    }
    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" /> Share Attachment
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Dropzone */}
        <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-850">
          <input
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.zip,.docx,.doc"
          />
          <div className="w-14 h-14 rounded-2xl bg-indigo-950/80 text-indigo-400 flex items-center justify-center mb-3">
            <File className="w-7 h-7" />
          </div>
          {file ? (
            <div className="text-center">
              <p className="text-sm font-semibold text-white truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-semibold text-white">Click or drag file to upload</p>
              <p className="text-xs text-slate-400 mt-1">Images, Videos, PDFs, ZIP, DOCX, Audio</p>
            </div>
          )}
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload & Send'}
          </button>
        </div>
      </div>
    </div>
  );
};
