'use client';

import React, { useState, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { getSocket } from '@/hooks/useSocket';
import { fetchApi } from '@/lib/api';
import { Message } from '@/types';
import { Send, Paperclip, Smile, X, Mic, Trash2, Check } from 'lucide-react';
import { AttachmentModal } from './AttachmentModal';
import { toast } from 'sonner';

export const MessageInput: React.FC = () => {
  const [content, setContent] = useState('');
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ── Voice Recording State ───────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const typingTimeoutRef = useRef<any>(null);

  const { activeChatPartner, replyingTo, setReplyingTo, addMessage, updateMessage } = useChatStore();
  const { activeGroup } = useGroupStore();
  const { user } = useAuthStore();

  const emojis = ['😀', '😂', '😍', '🔥', '👍', '❤️', '🎉', '🙌', '😎', '🙏'];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    const socket = getSocket();
    if (!socket) return;

    if (activeChatPartner) {
      socket.emit('typing:start', { receiverId: activeChatPartner._id });
    } else if (activeGroup) {
      socket.emit('group:typing', { groupId: activeGroup._id, isTyping: true, userName: user?.name });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (activeChatPartner) {
        socket.emit('typing:stop', { receiverId: activeChatPartner._id });
      } else if (activeGroup) {
        socket.emit('group:typing', { groupId: activeGroup._id, isTyping: false, userName: user?.name });
      }
    }, 1500);
  };

  // ── Voice Recording Handlers ────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('[Voice Note Error]:', err);
      toast.error('Microphone access is required to record voice messages.');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current) return;

    const recorder = mediaRecorderRef.current;
    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (audioBlob.size === 0) {
        cancelRecording();
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        handleSend({
          url: base64Url,
          name: 'Voice Note',
          size: audioBlob.size,
          type: 'audio',
        });
      };
      reader.readAsDataURL(audioBlob);

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

      setIsRecording(false);
      setRecordingTime(0);
      audioChunksRef.current = [];
    };

    recorder.stop();
  };

  const formatRecordingTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const handleSend = async (attachment?: { url: string; name: string; size: number; type: string }) => {
    const textToSend = content.trim();
    if (!textToSend && !attachment) return;
    if (!user) return;

    setContent('');
    const currentReplyTo = replyingTo;
    setReplyingTo(null);
    setShowEmojiPicker(false);

    const socket = getSocket();
    if (socket) {
      if (activeChatPartner) socket.emit('typing:stop', { receiverId: activeChatPartner._id });
      else if (activeGroup) socket.emit('group:typing', { groupId: activeGroup._id, isTyping: false, userName: user.name });
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const optimisticMessage: Message = {
      _id: tempId,
      chatId: activeChatPartner?._id,
      groupId: activeGroup?._id,
      senderId: user,
      content: textToSend,
      type: attachment ? (attachment.type as any) : 'text',
      fileUrl: attachment?.url,
      fileName: attachment?.name,
      fileSize: attachment?.size,
      replyToId: currentReplyTo || undefined,
      isEdited: false,
      isPinned: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      seenBy: [{ userId: user._id, timestamp: new Date().toISOString() }],
      deliveredTo: [{ userId: user._id, timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addMessage(optimisticMessage);

    if (socket) {
      if (activeChatPartner) {
        socket.emit('message:send', { receiverId: activeChatPartner._id, message: optimisticMessage });
      } else if (activeGroup) {
        socket.emit('group:message-send', { groupId: activeGroup._id, message: optimisticMessage });
      }
    }

    try {
      const payload = {
        chatId: activeChatPartner?._id,
        groupId: activeGroup?._id,
        content: textToSend,
        type: attachment ? attachment.type : 'text',
        fileUrl: attachment?.url,
        fileName: attachment?.name,
        fileSize: attachment?.size,
        replyToId: currentReplyTo?._id,
      };

      const data = await fetchApi('/message/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      updateMessage({ ...data.message, _id: tempId });
      updateMessage(data.message);
    } catch (err: any) {
      console.error('Failed to persist message:', err);
      toast.error('Failed to sync message to server.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 relative">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2 p-2.5 bg-slate-800 border-l-4 border-indigo-500 rounded-r-xl flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold text-indigo-400">Replying to {replyingTo.senderId.name}</span>
            <p className="text-slate-400 truncate max-w-md">{replyingTo.content || '[Attachment]'}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Quick Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 bg-slate-800 border border-slate-700 p-2 rounded-2xl shadow-xl flex gap-1 z-20">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setContent((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="p-2 hover:bg-slate-700 rounded-xl text-lg transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-center gap-2 overflow-hidden">
        {isRecording ? (
          /* Voice Note Recording Bar */
          <div className="flex-1 flex items-center justify-between bg-slate-800 border border-rose-500/50 p-2 px-4 rounded-2xl animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span className="text-xs font-mono font-bold text-rose-400">{formatRecordingTime(recordingTime)}</span>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">Recording voice note...</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                className="p-2 text-rose-400 hover:bg-rose-950 rounded-xl transition-colors"
                title="Cancel Voice Note"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={stopAndSendRecording}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center"
                title="Send Voice Note"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Normal Message Input Bar */
          <>
            <button
              onClick={() => setIsAttachmentOpen(true)}
              className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
              title="Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              onClick={startRecording}
              className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 min-w-0 py-2.5 px-4 bg-slate-800 border border-slate-700/60 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <button
              onClick={() => handleSend()}
              disabled={!content.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <AttachmentModal
        isOpen={isAttachmentOpen}
        onClose={() => setIsAttachmentOpen(false)}
        onSendAttachment={(attachment) => handleSend(attachment)}
      />
    </div>
  );
};
