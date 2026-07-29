'use client';

import React, { useEffect, useState } from 'react';
import { useGroupStore } from '@/store/useGroupStore';
import { fetchApi, uploadToCloudinary } from '@/lib/api';
import { User } from '@/types';
import { X, Users, Camera, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose }) => {
  const { addGroup } = useGroupStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [friends, setFriends] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchApi('/friend/list').then((data) => setFriends(data.friends || []));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        const result = await uploadToCloudinary(e.target.files[0]);
        setAvatar(result.url);
        toast.success('Group avatar uploaded.');
      } catch (err) {
        toast.error('Failed to upload group avatar.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const toggleMemberSelection = (friendId: string) => {
    if (selectedMembers.includes(friendId)) {
      setSelectedMembers((prev) => prev.filter((id) => id !== friendId));
    } else {
      setSelectedMembers((prev) => [...prev, friendId]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const data = await fetchApi('/group/create', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          avatar,
          description,
          privacy,
          members: selectedMembers,
        }),
      });

      addGroup(data.group);
      toast.success('Group created successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Create New Group
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative group cursor-pointer">
              <div className="w-20 h-20 rounded-2xl bg-indigo-900/60 border-2 border-indigo-500/40 text-white font-bold flex items-center justify-center overflow-hidden">
                {avatar ? (
                  <img src={avatar} alt="Group Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-indigo-300" />
                )}
              </div>
              <label className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                <input type="file" onChange={handleAvatarUpload} accept="image/*" className="hidden" />
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Click to set group avatar</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Developers"
              required
              className="w-full py-2.5 px-3.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full py-2.5 px-3.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Member Selection List */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Invite Friends</label>
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-850 rounded-xl border border-slate-800">
              {friends.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No friends available to add.</p>
              ) : (
                friends.map((friend) => {
                  const isSelected = selectedMembers.includes(friend._id);
                  return (
                    <div
                      key={friend._id}
                      onClick={() => toggleMemberSelection(friend._id)}
                      className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-700 font-bold text-white text-xs flex items-center justify-center overflow-hidden">
                          {friend.profilePic ? (
                            <img src={friend.profilePic} alt={friend.name} className="w-full h-full object-cover" />
                          ) : (
                            friend.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-xs font-semibold">{friend.name}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
