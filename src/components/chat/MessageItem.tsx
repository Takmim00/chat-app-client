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
  AlertCircle,
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
      className={`group relative flex gap-2.5 my-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {!isMe && (
        <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 mb-1">
          {senderPic ? (
            <img src={senderPic} alt={senderName} className="w-full h-full object-cover" />
          ) : (
            senderName?.charAt(0).toUpperCase()
          )}
        </div>
      )}

      {/* Message Bubble Container */}
      <div className={`max-w-[85%] sm:max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMe && (
          <span className="text-[11px] text-[#00a884] font-semibold ml-1 mb-0.5">
            {senderName}
          </span>
        )}

        {/* Pinned Indicator */}
        {message.isPinned && (
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400 mb-1">
            <Pin className="w-3 h-3 fill-amber-400" /> Pinned Message
          </div>
        )}

        {/* Reply Preview Header */}
        {message.replyToId && (
          <div className="p-2 px-3 mb-1 bg-[#111b21]/70 border-l-4 border-[#00a884] rounded-r-lg text-xs text-[#e9edef]">
            <p className="font-semibold text-[#00a884] text-[11px]">Replying to {message.replyToId.senderId?.name || 'message'}</p>
            <p className="truncate text-[#8696a0] text-[11px] mt-0.5">{message.replyToId.content || '[Media file]'}</p>
          </div>
        )}

        {/* Main Bubble */}
        <div
          className={`p-2.5 px-3.5 rounded-lg text-sm relative shadow-sm ${
            isMe
              ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
              : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#222d34]'
          }`}
        >
          {message.isForwarded && (
            <div className="flex items-center gap-1 text-[10px] text-[#8696a0] mb-1 italic">
              <Forward className="w-3 h-3" /> Forwarded{message.forwardedFrom ? ` from ${message.forwardedFrom.name}` : ''}
            </div>
          )}
          {message.isDeletedForEveryone ? (
            <span className="italic text-[#8696a0] text-xs">This message was deleted</span>
          ) : isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 bg-[#111b21] border border-[#00a884] rounded text-white text-xs"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button onClick={() => setIsEditing(false)} className="text-[#8696a0]">Cancel</button>
                <button onClick={handleSaveEdit} className="text-[#00a884] font-bold">Save</button>
              </div>
            </div>
          ) : (
            <>
              {/* Media Content */}
              {message.fileUrl && (
                <div className="mb-2">
                  {(message.type === 'image' || message.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || message.fileUrl.startsWith('data:image/')) ? (
                    <img src={message.fileUrl} alt="attachment" className="max-w-xs rounded-lg border border-[#222d34] shadow-md" />
                  ) : (message.type === 'video' || message.fileUrl.match(/\.(mp4|webm|ogg)/i)) ? (
                    <video src={message.fileUrl} controls className="max-w-xs rounded-lg shadow-md" />
                  ) : (message.type === 'audio' || message.fileUrl.match(/\.(mp3|wav|ogg|m4a|webm)/i) || message.fileUrl.startsWith('data:audio/')) ? (
                    <VoicePlayer src={message.fileUrl} isMe={isMe} />
                  ) : (
                    <a
                      href={message.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-[#111b21]/60 rounded-lg flex items-center gap-3 text-xs text-[#00a884] hover:bg-[#111b21] transition-colors"
                    >
                      <FileText className="w-6 h-6 text-[#00a884] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-[#e9edef]">{message.fileName || 'Attachment Document'}</p>
                        <p className="text-[10px] text-[#8696a0]">{formatFileSize(message.fileSize)}</p>
                      </div>
                      <Download className="w-4 h-4 shrink-0" />
                    </a>
                  )}
                </div>
              )}

              {/* Text Content */}
              {message.content && <p className="whitespace-pre-wrap break-words leading-relaxed text-[#e9edef]">{message.content}</p>}
              {message.type === 'text' && message.content && extractUrl(message.content) && (
                <LinkPreview url={extractUrl(message.content)!} isMe={isMe} />
              )}

              {/* Reactions display */}
              {message.reactions && message.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {message.reactions.map((r, idx) => (
                    <span key={idx} className="bg-[#111b21] px-2 py-0.5 rounded-full text-xs border border-[#222d34]">
                      {r.emoji}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Footer Metadata */}
          <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-[#8696a0]">
            {message.isEdited && <span>(edited)</span>}
            <span>{formatTime(message.createdAt)}</span>
            {isMe && (
              <span title={message.isFailed ? 'Failed to send' : isSeenByRecipient ? 'Seen' : 'Sent'}>
                {message.isFailed ? (
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                ) : isSeenByRecipient ? (
                  <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                ) : (
                  <Check className="w-4 h-4 text-[#8696a0]" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Quick Actions */}
      {showActions && !message.isDeletedForEveryone && (
        <div className="flex items-center gap-0.5 self-center bg-slate-900/90 border border-slate-700/80 p-1 px-1.5 rounded-full shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <button onClick={() => handleAddReaction('❤️')} className="p-1 hover:bg-slate-800 rounded-full text-xs transition-transform hover:scale-125">❤️</button>
          <button onClick={() => handleAddReaction('👍')} className="p-1 hover:bg-slate-800 rounded-full text-xs transition-transform hover:scale-125">👍</button>
          <button onClick={() => setReplyingTo(message)} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Reply">
            <Reply className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setForwardingMessage(message)} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Forward">
            <Forward className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleTogglePin} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Pin">
            <Pin className="w-3.5 h-3.5" />
          </button>
          {isMe && (
            <button onClick={() => setIsEditing(true)} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handleDeleteForMe} className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-full transition-colors" title="Delete for me">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {isMe && (
            <button onClick={handleDeleteForEveryone} className="px-2 py-1 text-rose-400 hover:bg-rose-950/60 rounded-full text-[10px] font-bold transition-colors" title="Delete for everyone">
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
