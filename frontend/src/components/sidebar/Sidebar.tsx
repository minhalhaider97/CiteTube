import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Video, 
  Sliders, 
  Settings, 
  Keyboard, 
  LogOut, 
  MoreHorizontal,
  ChevronDown,
  Layers,
  GitFork
} from 'lucide-react';
import logoFull from '../../assets/Vector-2.png';

interface SidebarProps {
  chats: Array<{ id: string; title: string }>;
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
}

export default function Sidebar({ chats, activeChatId, onSelectChat, onNewChat, onLogout }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Example categorization matching Image 2
  const todayChats = chats.slice(0, 2);
  const previousChats = chats.slice(2);

  return (
    <aside className="flex flex-col h-screen w-64 bg-[#101012] border-r border-[#232326] p-3 select-none shrink-0 font-sans text-xs">
      {/* Top Header Logo */}
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <img src={logoFull} alt="CiteTube Logo" className="h-6 w-auto object-contain" />
        <button className="text-neutral-500 hover:text-white p-1 rounded-md hover:bg-neutral-800/50">
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* New Video Chat Button */}
      <button
        onClick={onNewChat}
        className="flex items-center justify-between w-full rounded-lg bg-[#18181B] border border-[#27272A] px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition mb-3"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-neutral-400" />
          <span>New Video Chat</span>
        </span>
        <kbd className="font-mono text-[10px] bg-[#27272A] text-neutral-400 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {/* Filter / Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
        <input
          type="text"
          placeholder="Filter chats, chunks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-md bg-[#161618] border border-[#232326] pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-sans"
        />
      </div>

      {/* Chat History List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* TODAY Section */}
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase px-2 mb-1">
            Today
          </div>
          <div className="space-y-0.5">
            {todayChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`group flex items-center justify-between rounded-md px-2.5 py-2 cursor-pointer transition ${
                  activeChatId === chat.id ? 'bg-[#1D1D21] text-white' : 'text-neutral-400 hover:bg-[#161618] hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Video className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  <span className="truncate">{chat.title}</span>
                </div>
                <MoreHorizontal className="h-3.5 w-3.5 text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-white" />
              </div>
            ))}
          </div>
        </div>

        {/* PREVIOUS 7 DAYS Section */}
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase px-2 mb-1">
            Previous 7 Days
          </div>
          <div className="space-y-0.5">
            {previousChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`group flex items-center justify-between rounded-md px-2.5 py-2 cursor-pointer transition ${
                  activeChatId === chat.id ? 'bg-[#1D1D21] text-white' : 'text-neutral-400 hover:bg-[#161618] hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <GitFork className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  <span className="truncate">{chat.title}</span>
                </div>
                <MoreHorizontal className="h-3.5 w-3.5 text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-white" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer / Account / Quota Section */}
      <div className="pt-3 border-t border-[#232326] space-y-3">
        {/* Quota Bar */}
        <div className="bg-[#141416] border border-[#232326] rounded-lg p-2.5">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="flex items-center gap-1.5 text-neutral-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              Personal Workspace
            </span>
            <ChevronDown className="h-3 w-3 text-neutral-500" />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mt-2 mb-1">
            <span>Indexed Quota</span>
            <span className="text-white">42 / 100 hrs</span>
          </div>
          <div className="w-full bg-[#232326] h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-rose-400 h-full w-[42%]"></div>
          </div>
        </div>

        {/* Shortcuts & Settings */}
        <div className="flex items-center justify-between text-neutral-400 text-[11px] px-1">
          <button className="flex items-center gap-1.5 hover:text-white transition">
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
          <button className="flex items-center gap-1.5 hover:text-white transition">
            <Keyboard className="h-3.5 w-3.5" />
            <span>Shortcuts</span>
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-neutral-700 flex items-center justify-center font-semibold text-white text-xs">
              AV
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium text-white">Alex Vance</span>
              <span className="text-[10px] text-neutral-500">alex@research.ai</span>
            </div>
          </div>
          <button onClick={onLogout} title="Log out" className="text-neutral-500 hover:text-white p-1">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}