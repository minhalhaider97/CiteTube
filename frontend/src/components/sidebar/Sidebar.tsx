import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, Command, LogOut, MoreHorizontal,
  Plus, Search, Settings, Video, X,
} from 'lucide-react';
import logoFull from '../../assets/Vector-2.png';
import logoMark from '../../assets/Vector.png';

export type SidebarChat = { id: string; title: string; created_at: string };

type SidebarProps = {
  chats: SidebarChat[];
  activeChatId: string | null;
  collapsed: boolean;
  mobileOpen: boolean;
  userEmail?: string;
  onToggle: () => void;
  onCloseMobile: () => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
};

export default function Sidebar({
  chats, activeChatId, collapsed, mobileOpen, userEmail, onToggle,
  onCloseMobile, onSelectChat, onNewChat, onLogout,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredChats = useMemo(
    () => chats.filter((chat) => chat.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [chats, searchTerm],
  );
  const [now] = useState(() => Date.now());
  const today = filteredChats.filter(
    (chat) => now - new Date(chat.created_at).getTime() < 24 * 60 * 60 * 1000,
  );
  const previous = filteredChats.filter(
    (chat) => now - new Date(chat.created_at).getTime() >= 24 * 60 * 60 * 1000,
  );
  const initials = (userEmail || 'CT').slice(0, 2).toUpperCase();

  const renderGroup = (label: string, group: SidebarChat[]) => (
    <div className="space-y-1">
      {!collapsed && <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">{label}</p>}
      {group.map((chat) => (
        <button
          key={chat.id}
          type="button"
          title={chat.title}
          onClick={() => { onSelectChat(chat.id); onCloseMobile(); }}
          className={`group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-all duration-200 ${
            activeChatId === chat.id
              ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]'
              : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <Video className={`h-3.5 w-3.5 shrink-0 ${activeChatId === chat.id ? 'text-[#FF3B3B]' : ''}`} />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{chat.title}</span>}
          {!collapsed && <MoreHorizontal className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {mobileOpen && <button type="button" aria-label="Close navigation" onClick={onCloseMobile} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.07] bg-[#0c0c0f]/95 p-3 shadow-2xl backdrop-blur-xl transition-all duration-300 md:relative md:z-20 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[72px]' : 'w-[280px] md:w-[260px]'}`}>
        <div className="mb-3 flex h-10 items-center justify-between px-1">
          {!collapsed && <img src={logoFull} alt="CiteTube" className="h-6 w-auto" />}
          {collapsed && <img src={logoMark} alt="CiteTube" className="mx-auto h-7 w-7 object-contain" />}
          <button type="button" onClick={onToggle} className="hidden rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.06] hover:text-white md:block" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onCloseMobile} className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.06] hover:text-white md:hidden" aria-label="Close sidebar"><X className="h-4 w-4" /></button>
        </div>

        <button type="button" title="New video chat" onClick={() => { onNewChat(); onCloseMobile(); }} className={`mb-3 flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.045] text-xs font-medium text-zinc-100 transition hover:border-[#FF3B3B]/40 hover:bg-[#FF3B3B]/[0.08] ${collapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <span className="flex items-center gap-2">
            {collapsed ? (
              <span className="relative"><Video className="h-4 w-4 text-[#FF3B3B]" /><Plus className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-[#0c0c0f] text-[#FF3B3B]" /></span>
            ) : <Plus className="h-4 w-4 text-[#FF3B3B]" />}
            {!collapsed && 'New Video Chat'}
          </span>
          {!collapsed && <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">⌘K</kbd>}
        </button>

        {!collapsed && (
          <label className="relative mb-4 block">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Filter video chats..." className="h-9 w-full rounded-xl border border-white/[0.06] bg-black/20 pl-9 pr-3 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-[#FF3B3B]/35" />
          </label>
        )}

        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          {!collapsed && renderGroup('Today', today)}
          {!collapsed && renderGroup('Previous 7 days', previous)}
          {filteredChats.length === 0 && !collapsed && <p className="px-3 py-6 text-center text-xs text-zinc-600">No chats found.</p>}
        </div>

        {!collapsed && (
          <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
              <div className="flex items-center justify-between text-[10px] text-zinc-500"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Personal workspace</span><ChevronDown className="h-3 w-3" /></div>
              <div className="mt-3 flex items-center justify-between font-mono text-[9px] text-zinc-600"><span>INDEXED QUOTA</span><span>42 / 100 HRS</span></div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800"><div className="h-full w-[42%] rounded-full bg-gradient-to-r from-[#FF3B3B] to-[#FF6B70]" /></div>
            </div>
            <div className="flex items-center justify-between px-1 text-[10px] text-zinc-600"><span className="flex items-center gap-1.5"><Settings className="h-3 w-3" />Settings</span><span className="flex items-center gap-1.5"><Command className="h-3 w-3" />Shortcuts</span></div>
          </div>
        )}

        {!collapsed && <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-[10px] font-semibold text-white">{initials}</div>
            {!collapsed && <div className="min-w-0"><p className="text-[11px] font-medium text-zinc-200">Research workspace</p><p className="truncate text-[9px] text-zinc-600">{userEmail}</p></div>}
          </div>
          {!collapsed && <button type="button" onClick={onLogout} aria-label="Log out" className="rounded-lg p-2 text-zinc-600 hover:bg-white/[0.05] hover:text-white"><LogOut className="h-3.5 w-3.5" /></button>}
        </div>}
      </aside>
    </>
  );
}
