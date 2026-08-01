'use client';

import React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { MessageSquare, Users, UserPlus, Phone, Copy, Check, LogOut, Sun, Moon, Sparkles, Plus } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

interface SidebarProps {
  onOpenProfile: () => void;
  onOpenAddFriend: () => void;
  onOpenCreateGroup: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenProfile,
  onOpenAddFriend,
  onOpenCreateGroup,
}) => {
  const { user, logout } = useAuthStore();
  const { activeTab, setActiveTab } = useChatStore();
  const { theme, setTheme } = useTheme();
  const [copied, setCopied] = React.useState(false);

  const copyFriendId = () => {
    if (user?.friendId) {
      navigator.clipboard.writeText(user.friendId);
      setCopied(true);
      toast.success(`Friend ID ${user.friendId} copied!`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* DESKTOP SIDEBAR (md and above) */}
      <div className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between h-full select-none shrink-0">
        <div>
          {/* Top Header */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-indigo-500/20 shrink-0">
                <img src="/logo.png" alt="Aurora Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base leading-tight">Aurora</h2>
                <p className="text-[11px] text-slate-400">Messenger & Voice</p>
              </div>
            </div>
          </div>

          {/* User Card */}
          {user && (
            <div className="p-3 m-2 bg-slate-800/50 hover:bg-slate-800 rounded-2xl border border-slate-700/50 transition-all">
              <div className="flex items-center gap-3">
                <button onClick={onOpenProfile} className="relative group focus:outline-none shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-base overflow-hidden border border-indigo-400">
                    {user.profilePic ? (
                      <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
                </button>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate cursor-pointer" onClick={onOpenProfile}>
                    {user.name}
                  </h4>
                  <button
                    onClick={copyFriendId}
                    className="mt-0.5 flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md hover:bg-indigo-900/60 transition-colors"
                  >
                    <span className="font-mono">{user.friendId}</span>
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <nav className="p-2 space-y-1">
            <button
              onClick={() => setActiveTab('chats')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'chats'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span>Chats</span>
            </button>

            <button
              onClick={() => setActiveTab('groups')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'groups'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Groups</span>
            </button>

            <button
              onClick={() => setActiveTab('friends')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'friends'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <UserPlus className="w-5 h-5" />
              <span>Friend Requests</span>
            </button>

            <button
              onClick={() => setActiveTab('calls')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'calls'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Phone className="w-5 h-5" />
              <span>Call Logs</span>
            </button>
          </nav>
        </div>

        {/* Bottom Controls */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={onOpenAddFriend}
            className="w-full py-2.5 px-3 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Friend</span>
          </button>

          <button
            onClick={onOpenCreateGroup}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <Users className="w-4 h-4" />
            <span>Create Group</span>
          </button>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={logout}
              className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-xl transition-colors"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE BAR (Top Mobile Header + Bottom Touch Bar) */}
      <div className="md:hidden flex flex-col bg-slate-900 border-b border-slate-800 shrink-0">
        {/* Mobile Top Header */}
        <div className="p-3 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <button onClick={onOpenProfile} className="relative">
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center overflow-hidden border border-indigo-400">
                {user?.profilePic ? (
                  <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user?.name.charAt(0).toUpperCase()
                )}
              </div>
            </button>
            <div>
              <h3 className="text-xs font-bold text-white leading-tight">{user?.name}</h3>
              <button onClick={copyFriendId} className="text-[10px] text-indigo-300 font-mono flex items-center gap-1">
                <span>{user?.friendId}</span>
                {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={onOpenAddFriend} className="p-2 bg-indigo-600/20 text-indigo-300 rounded-lg text-xs" title="Add Friend">
              <UserPlus className="w-4 h-4" />
            </button>
            <button onClick={onOpenCreateGroup} className="p-2 bg-slate-800 text-slate-200 rounded-lg text-xs" title="Create Group">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={logout} className="p-2 text-rose-400 hover:bg-rose-950/50 rounded-lg">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex items-center justify-around p-1.5 bg-slate-950 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-xl text-[11px] font-medium transition-all ${
              activeTab === 'chats' ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-400'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chats</span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-xl text-[11px] font-medium transition-all ${
              activeTab === 'groups' ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Groups</span>
          </button>

          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-xl text-[11px] font-medium transition-all ${
              activeTab === 'friends' ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-400'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Requests</span>
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-xl text-[11px] font-medium transition-all ${
              activeTab === 'calls' ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-400'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Calls</span>
          </button>
        </div>
      </div>
    </>
  );
};
