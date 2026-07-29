'use client';

import React, { useState } from 'react';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import { X, Users, Copy, Check, Shield, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({ isOpen, onClose }) => {
  const { activeGroup, updateGroup } = useGroupStore();
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !activeGroup) return null;

  const isOwner = activeGroup.ownerId._id === user?._id;
  const isAdmin = activeGroup.admins.some((a) => a._id === user?._id);

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/${activeGroup.inviteLinkCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success('Group invite link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await fetchApi(`/group/member/remove/${activeGroup._id}`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      });
      const updatedMembers = activeGroup.members.filter((m) => m._id !== memberId);
      updateGroup({ ...activeGroup, members: updatedMembers });
      toast.success('Member removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Group Settings & Members
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group Header Info */}
        <div className="flex items-center gap-4 p-4 bg-slate-850 rounded-2xl border border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 font-bold text-2xl text-white flex items-center justify-center overflow-hidden shrink-0">
            {activeGroup.avatar ? (
              <img src={activeGroup.avatar} alt={activeGroup.name} className="w-full h-full object-cover" />
            ) : (
              activeGroup.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-white truncate">{activeGroup.name}</h4>
            <p className="text-xs text-slate-400 truncate mt-0.5">{activeGroup.description || 'No description'}</p>
            <span className="inline-block text-[10px] bg-indigo-950 text-indigo-300 font-mono px-2 py-0.5 rounded mt-1">
              ID: {activeGroup.groupId}
            </span>
          </div>
        </div>

        {/* Invite Link Section */}
        <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Invite Code Link</span>
            <p className="text-xs font-mono text-indigo-300 truncate max-w-xs">{activeGroup.inviteLinkCode}</p>
          </div>
          <button
            onClick={copyInviteLink}
            className="p-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white rounded-xl transition-colors text-xs flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>Copy Link</span>
          </button>
        </div>

        {/* Members List */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3">
            Group Members ({activeGroup.members.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-850 rounded-xl border border-slate-800">
            {activeGroup.members.map((member) => {
              const isGroupOwner = activeGroup.ownerId._id === member._id;
              const isGroupAdmin = activeGroup.admins.some((a) => a._id === member._id);

              return (
                <div
                  key={member._id}
                  className="p-3 bg-slate-800/60 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 font-bold text-white text-xs flex items-center justify-center overflow-hidden">
                      {member.profilePic ? (
                        <img src={member.profilePic} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        member.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-white flex items-center gap-1.5">
                        {member.name}
                        {isGroupOwner && (
                          <span className="text-[9px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                            Owner
                          </span>
                        )}
                        {isGroupAdmin && !isGroupOwner && (
                          <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" /> Admin
                          </span>
                        )}
                      </h5>
                      <p className="text-[10px] text-slate-400 font-mono">ID: {member.friendId}</p>
                    </div>
                  </div>

                  {(isOwner || isAdmin) && member._id !== user?._id && (
                    <button
                      onClick={() => handleRemoveMember(member._id)}
                      className="p-1.5 text-rose-400 hover:bg-rose-950 rounded-lg transition-colors"
                      title="Remove Member"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
