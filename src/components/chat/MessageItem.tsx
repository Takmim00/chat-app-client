'use client';

import React, { useState } from 'react';
import { Message, User } from '@/types';
import { formatTime, formatFileSize } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useCallStore, callWebRTCRef } from '@/store/useCallStore';
import { fetchApi } from '@/lib/api';
import { VoicePlayer } from './VoicePlayer';
import { ForwardModal } from './ForwardModal';
import { LinkPreview } from './LinkPreview';
import {
  Pin,
  Reply,
  Forward,
  Edit2,
  Trash2,
  Smile,
  FileText,
  Download,
  Check,
  CheckCheck,
  MoreVertical,
  Volume2,
  Phone,
  PhoneMissed,
  PhoneIncoming,
} from 'lucide-react';
import { toast } from 'sonner';

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const extractUrl = (text: string): string | null => {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
};

interface MessageItemProps {
  message: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const { user } = useAuthStore();
  const { setReplyingTo, updateMessage, deleteMessage } = useChatStore();
  const { initiateCall } = useCallStore();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  const senderObj = typeof message.senderId === 'object' ? message.senderId : null;
  const senderIdStr = senderObj ? senderObj._id : (message.senderId as any);
  const isMe = senderIdStr === user?._id;
  const senderName = senderObj?.name || (isMe ? user?.name : 'Member');
  const senderPic = senderObj?.profilePic || (isMe ? user?.profilePic : undefined);

  const isSeenByRecipient = Boolean(
    message.seenBy &&
    message.seenBy.some((s) => {
      const sId = typeof s.userId === 'object' ? (s.userId as any)._id : s.userId;
      return sId && String(sId) !== String(user?._id);
    })
  );

  // Call back: the person to call is the OTHER person in the call message
  const handleCallBack = () => {
    // The partner is whoever is NOT me in this call message
    const otherPerson: any = senderObj && senderIdStr !== user?._id
      ? senderObj
      : useChatStore.getState().activeChatPartner;

    if (!otherPerson) return;
    initiateCall(otherPerson);
    if (callWebRTCRef.startCallFn) {
      callWebRTCRef.startCallFn(otherPerson);
    }
  };

  const handleTogglePin = async () => {
    try {
      const data = await fetchApi(`/message/pin/${message._id}`, { method: 'PUT' });
      updateMessage(data.message);
      toast.success(data.message.isPinned ? 'Message pinned!' : 'Message unpinned.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update pin state.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      const data = await fetchApi(`/message/edit/${message._id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent }),
      });
      updateMessage(data.message);
      setIsEditing(false);
      toast.success('Message edited.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to edit message.');
    }
  };

  const handleDeleteForMe = async () => {
    try {
      await fetchApi(`/message/delete-for-me/${message._id}`, { method: 'DELETE' });
      deleteMessage(message._id, false, user!._id);
      toast.success('Deleted for you.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete message.');
    }
  };

  const handleDeleteForEveryone = async () => {
    try {
      const data = await fetchApi(`/message/delete-everyone/${message._id}`, { method: 'DELETE' });
      updateMessage(data.message);
      toast.success('Deleted for everyone.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete for everyone.');
    }
  };

  const handleAddReaction = async (emoji: string) => {
    try {
      const data = await fetchApi(`/message/react/${message._id}`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      updateMessage(data.message);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (message.deletedFor?.includes(user?._id || '')) {
    return null;
  }

  // ── Call Event Bubble (Messenger-style) ─────────────────────────────────────
  if (message.type === 'call') {
    const isMissed = message.callStatus === 'missed' || message.callStatus === 'rejected';
    const durationMins = message.callDuration && message.callDuration > 0
      ? Math.ceil(message.callDuration / 60)
      : 0;
    const durationLabel = durationMins > 0
      ? `${durationMins} min${durationMins !== 1 ? 's' : ''}`
      : null;

    return (
      <div className="flex justify-center my-3">
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-md min-w-[220px] max-w-xs ${
          isMissed
            ? 'bg-rose-950/40 border-rose-800/40'
            : 'bg-emerald-950/40 border-emerald-800/40'
        }`}>
          {/* Icon */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isMissed ? 'bg-rose-900/60' : 'bg-emerald-900/60'
          }`}>
            {isMissed
              ? <PhoneMissed className="w-5 h-5 text-rose-400" />
              : <PhoneIncoming className="w-5 h-5 text-emerald-400" />
            }
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${
              isMissed ? 'text-rose-300' : 'text-emerald-300'
            }`}>
              {isMissed ? 'Missed audio call' : 'Audio call'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {durationLabel ? durationLabel : formatTime(message.createdAt)}
            </p>
          </div>

          {/* Call back button */}
          <button
            onClick={handleCallBack}
            className={`p-2 rounded-xl text-xs font-semibold transition-all ${
              isMissed
                ? 'bg-rose-800/50 hover:bg-rose-700 text-rose-200'
                : 'bg-emerald-800/50 hover:bg-emerald-700 text-emerald-200'
            }`}
            title={isMissed ? 'Call back' : 'Call again'}
          >
            <Phone className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`group relative flex gap-3 my-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {!isMe && (
        <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 mt-1">
          {senderPic ? (
            <img src={senderPic} alt={senderName} className="w-full h-full object-cover" />
          ) : (
            senderName?.charAt(0).toUpperCase()
          )}
        </div>
      )}

      {/* Message Bubble Container */}
      <div className={`max-w-[85%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMe && (
          <span className="text-[11px] text-slate-400 font-medium ml-1 mb-0.5">
            {senderName}
          </span>
        )}

        {/* Pinned Indicator */}
        {message.isPinned && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 mb-1">
            <Pin className="w-3 h-3 fill-amber-400" /> Pinned Message
          </div>
        )}

        {/* Reply Preview Header */}
        {message.replyToId && (
          <div className="p-2 mb-1 bg-slate-800/80 border-l-2 border-indigo-500 rounded-r-lg text-xs text-slate-300">
            <p className="font-medium text-indigo-400">Replying to previous message</p>
            <p className="truncate text-slate-400">{message.replyToId.content || '[Media file]'}</p>
          </div>
        )}

        {/* Main Bubble */}
        <div
          className={`p-3.5 rounded-2xl text-sm relative shadow-md ${
            isMe
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
              : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/60'
          }`}
        >
          {message.isForwarded && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 italic">
              <Forward className="w-3 h-3" /> Forwarded{message.forwardedFrom ? ` from ${message.forwardedFrom.name}` : ''}
            </div>
          )}
          {message.isDeletedForEveryone ? (
            <span className="italic text-slate-400 text-xs">This message was deleted</span>
          ) : isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 bg-slate-900 border border-indigo-400 rounded text-white text-xs"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button onClick={() => setIsEditing(false)} className="text-slate-400">Cancel</button>
                <button onClick={handleSaveEdit} className="text-indigo-400 font-bold">Save</button>
              </div>
            </div>
          ) : (
            <>
              {/* Media Content */}
              {message.fileUrl && (
                <div className="mb-2">
                  {(message.type === 'image' || message.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || message.fileUrl.startsWith('data:image/')) ? (
                    <img src={message.fileUrl} alt="attachment" className="max-w-xs rounded-xl border border-slate-700/50 shadow-md" />
                  ) : (message.type === 'video' || message.fileUrl.match(/\.(mp4|webm|ogg)/i)) ? (
                    <video src={message.fileUrl} controls className="max-w-xs rounded-xl shadow-md" />
                  ) : (message.type === 'audio' || message.fileUrl.match(/\.(mp3|wav|ogg|m4a|webm)/i) || message.fileUrl.startsWith('data:audio/')) ? (
                    <VoicePlayer src={message.fileUrl} isMe={isMe} />
                  ) : (
                    <a
                      href={message.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-slate-900/60 rounded-xl flex items-center gap-3 text-xs text-indigo-300 hover:bg-slate-900 transition-colors"
                    >
                      <FileText className="w-6 h-6 text-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-white">{message.fileName || 'Attachment Document'}</p>
                        <p className="text-[10px] text-slate-400">{formatFileSize(message.fileSize)}</p>
                      </div>
                      <Download className="w-4 h-4 shrink-0" />
                    </a>
                  )}
                </div>
              )}

              {/* Text Content */}
              {message.content && <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>}
              {message.type === 'text' && message.content && extractUrl(message.content) && (
                <LinkPreview url={extractUrl(message.content)!} isMe={isMe} />
              )}

              {/* Reactions display */}
              {message.reactions && message.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {message.reactions.map((r, idx) => (
                    <span key={idx} className="bg-slate-900/70 px-2 py-0.5 rounded-full text-xs border border-slate-700">
                      {r.emoji}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Footer Metadata */}
          <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-75">
            {message.isEdited && <span>(edited)</span>}
            <span>{formatTime(message.createdAt)}</span>
            {isMe && (
              <span title={isSeenByRecipient ? 'Seen' : 'Sent'}>
                {isSeenByRecipient ? (
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-slate-400" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Quick Actions */}
      {showActions && !message.isDeletedForEveryone && (
        <div className="flex items-center gap-1 self-center bg-slate-800/90 border border-slate-700 p-1 rounded-xl shadow-lg backdrop-blur-md">
          <button onClick={() => handleAddReaction('❤️')} className="p-1 hover:bg-slate-700 rounded text-xs">❤️</button>
          <button onClick={() => handleAddReaction('👍')} className="p-1 hover:bg-slate-700 rounded text-xs">👍</button>
          <button onClick={() => setReplyingTo(message)} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="Reply">
            <Reply className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setForwardingMessage(message)} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="Forward">
            <Forward className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleTogglePin} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="Pin">
            <Pin className="w-3.5 h-3.5" />
          </button>
          {isMe && (
            <button onClick={() => setIsEditing(true)} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handleDeleteForMe} className="p-1.5 text-rose-400 hover:bg-rose-950 rounded" title="Delete for me">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {isMe && (
            <button onClick={handleDeleteForEveryone} className="p-1.5 text-rose-400 hover:bg-rose-950 rounded text-[10px] font-bold" title="Delete for everyone">
              All
            </button>
          )}
        </div>
      )}

      <ForwardModal
        isOpen={!!forwardingMessage}
        message={forwardingMessage}
        onClose={() => setForwardingMessage(null)}
      />
    </div>
  );
};
