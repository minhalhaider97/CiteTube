import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronRight, Clipboard, Clock3, Copy, Download,
  Eye, EyeOff, FileText, Layers3, Menu, Play, Search, Send, Share2,
  Sparkles, Video, WandSparkles, X,
} from 'lucide-react';
import { fetcher } from '../../lib/api';
import { supabase } from '../../lib/auth';
import Sidebar, { type SidebarChat } from '../sidebar/Sidebar';
import YouTubePlayer, { type YouTubePlayerHandle } from '../video/YouTubePlayer';
import vectorIcon from '../../assets/Vector.png';

type Chat = SidebarChat & {
  user_id: string;
  video_id: string;
  youtube_id: string | null;
  channel_name: string | null;
  duration_seconds: number | null;
};

type Citation = {
  index?: number;
  chunk_id: string;
  start_seconds: number;
  end_seconds: number;
  timestamp_formatted: string;
  url: string;
  content: string;
};

type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
};

type TranscriptChunk = {
  id: string;
  chunk_index: number;
  content: string;
  start_seconds: number;
  end_seconds: number;
};

type VideoState = {
  id: string;
  youtube_id: string;
  title: string;
  channel_name: string | null;
  duration_seconds: number | null;
};

const SUGGESTIONS = [
  'Summarize the main ideas in this video',
  'What evidence supports the central argument?',
  'List the most important cited timestamps',
];

const PIPELINE_STEPS = [
  'Fetching closed captions',
  'Building transcript chunks',
  'Generating vector embeddings',
  'Timestamp index verified',
];

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export default function ChatInterface() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [query, setQuery] = useState('');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestionStep, setIngestionStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [videoVisible, setVideoVisible] = useState(true);
  const [mobileTab, setMobileTab] = useState<'chat' | 'transcript'>('chat');
  const [mediaTab, setMediaTab] = useState<'transcript' | 'keyframes'>('transcript');
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchChats = useCallback(async (userId: string) => {
    try {
      const data = await fetcher(`/chats?user_id=${userId}`);
      setChats(data ?? []);
      setError(null);
    } catch (requestError) {
      setChats([]);
      setError(requestError instanceof Error ? requestError.message : 'Failed to load chat history.');
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: activeUser } }) => {
      if (!activeUser) return;
      const normalized = { id: activeUser.id, email: activeUser.email };
      setUser(normalized);
      void fetchChats(activeUser.id);
    });
  }, [fetchChats]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const filteredTranscript = useMemo(
    () => transcript.filter((chunk) => chunk.content.toLowerCase().includes(transcriptSearch.toLowerCase())),
    [transcript, transcriptSearch],
  );
  const activeChunkId = useMemo(
    () => [...transcript].reverse().find((chunk) => currentTime >= chunk.start_seconds)?.id,
    [currentTime, transcript],
  );

  const handlePlayerTime = useCallback((seconds: number) => setCurrentTime(seconds), []);

  function startNewChat() {
    setActiveChatId(null);
    setVideo(null);
    setMessages([]);
    setTranscript([]);
    setError(null);
    setCurrentTime(0);
    setVideoVisible(true);
    setMobileTab('chat');
  }

  async function loadTranscript(videoId: string) {
    const chunks = await fetcher(`/videos/${videoId}/transcript`);
    setTranscript(chunks ?? []);
  }

  async function handleSelectChat(chatId: string) {
    if (!user) return;
    const selected = chats.find((chat) => chat.id === chatId);
    if (!selected) return;
    setActiveChatId(chatId);
    setMessages([]);
    setTranscript([]);
    setCurrentTime(0);
    setVideoVisible(true);
    setMobileTab('chat');
    setError(null);
    setLoading(true);
    setVideo(selected.youtube_id ? {
      id: selected.video_id,
      youtube_id: selected.youtube_id,
      title: selected.title,
      channel_name: selected.channel_name,
      duration_seconds: selected.duration_seconds,
    } : null);
    try {
      const [storedMessages] = await Promise.all([
        fetcher(`/messages/${chatId}?user_id=${user.id}`),
        loadTranscript(selected.video_id),
      ]);
      setMessages((storedMessages ?? []).map((message: {
        id: string;
        role: 'user' | 'assistant';
        content: string;
        message_metadata?: { citations?: Citation[] };
      }) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        citations: message.message_metadata?.citations ?? [],
      })));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to restore this video chat.');
    } finally {
      setLoading(false);
    }
  }

  async function handleIngest(event: React.FormEvent) {
    event.preventDefault();
    if (!urlInput.trim() || !user || ingesting) return;
    setIngesting(true);
    setIngestionStep(0);
    setError(null);
    const progressTimer = window.setInterval(
      () => setIngestionStep((step) => Math.min(step + 1, 2)),
      1100,
    );
    try {
      const ingested = await fetcher('/videos/ingest', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const created: Chat = await fetcher('/chats', {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id, video_id: ingested.id }),
      });
      setIngestionStep(3);
      setChats((previous) => [created, ...previous.filter((chat) => chat.id !== created.id)]);
      setActiveChatId(created.id);
      setVideo({
        id: ingested.id,
        youtube_id: ingested.youtube_id,
        title: ingested.title,
        channel_name: ingested.channel_name,
        duration_seconds: ingested.duration_seconds,
      });
      setMessages([]);
      await loadTranscript(ingested.id);
      setUrlInput('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Video ingestion failed.');
    } finally {
      window.clearInterval(progressTimer);
      window.setTimeout(() => setIngesting(false), 450);
    }
  }

  async function handleSendQuery(event?: React.FormEvent, suggestion?: string) {
    event?.preventDefault();
    const prompt = (suggestion ?? query).trim();
    if (!prompt || !activeChatId || !user || loading) return;
    setQuery('');
    setError(null);
    setMessages((previous) => [...previous, { role: 'user', content: prompt, citations: [] }]);
    setLoading(true);
    try {
      const response = await fetcher('/chats/query', {
        method: 'POST',
        body: JSON.stringify({ chat_id: activeChatId, user_id: user.id, query: prompt }),
      });
      setMessages((previous) => [...previous, {
        id: response.assistant_message_id,
        role: 'assistant',
        content: response.answer,
        citations: response.citations ?? [],
      }]);
      if (user) void fetchChats(user.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The question could not be answered.');
    } finally {
      setLoading(false);
    }
  }

  function seekTo(seconds: number) {
    setVideoVisible(true);
    setCurrentTime(seconds);
    playerRef.current?.seekTo(seconds);
  }

  async function copyAnswer(message: Message, key: string) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(key);
    window.setTimeout(() => setCopiedId(null), 1400);
  }

  function exportAnswer(message: Message) {
    const citations = message.citations.map(
      (citation) => `- [${citation.timestamp_formatted}](${citation.url}) ${citation.content}`,
    ).join('\n');
    const markdown = `# ${video?.title ?? 'CiteTube answer'}\n\n${message.content}\n\n## Sources\n\n${citations || 'No citations.'}\n`;
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'citetube-answer.md';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const renderTranscript = (showSearch = true) => (
    <div className="flex h-full min-h-0 flex-col">
      {showSearch && <div className="border-b border-white/[0.06] p-3">
        <label className="relative block">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" />
          <input value={transcriptSearch} onChange={(event) => setTranscriptSearch(event.target.value)} placeholder="Search spoken transcript..." className="h-9 w-full rounded-xl border border-white/[0.07] bg-black/20 pl-9 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-[#FF3B3B]/35" />
        </label>
      </div>}
      <div className="flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
        {filteredTranscript.map((chunk) => {
          const active = chunk.id === activeChunkId;
          return (
            <button key={chunk.id} type="button" onClick={() => seekTo(chunk.start_seconds)} className={`group flex min-h-[74px] w-full items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200 sm:gap-4 sm:p-4 ${active ? 'border-[#FF3B3B] bg-[#FF3B3B]/[0.08] shadow-[inset_3px_0_0_#FF3B3B]' : 'border-white/[0.06] bg-[#111114] hover:border-[#FF3B3B]/30 hover:bg-white/[0.035]'}`}>
              <span className={`mt-0.5 h-fit shrink-0 self-start whitespace-nowrap rounded-md px-2 py-1 font-mono text-[10px] leading-none ${active ? 'bg-[#FF3B3B] text-white shadow-[0_0_14px_rgba(255,59,59,.22)]' : 'bg-white/[0.05] text-zinc-500 group-hover:text-[#FF5A5F]'}`}>{formatTime(chunk.start_seconds)}</span>
              <span className="line-clamp-2 min-w-0 flex-1 text-[11px] leading-5 text-zinc-400 group-hover:text-zinc-200 sm:text-xs">{chunk.content}</span>
            </button>
          );
        })}
        {!filteredTranscript.length && <div className="px-5 py-12 text-center text-xs text-zinc-600">No transcript chunks match this search.</div>}
      </div>
    </div>
  );

  const renderKeyframes = () => (
    <div className="grid grid-cols-2 gap-3 overflow-y-auto p-4">
      {transcript.slice(0, 8).map((chunk, index) => (
        <button key={chunk.id} type="button" onClick={() => seekTo(chunk.start_seconds)} className="group overflow-hidden rounded-xl border border-white/[0.07] bg-[#111114] text-left transition hover:-translate-y-0.5 hover:border-[#FF3B3B]/30">
          <div className="relative aspect-video overflow-hidden bg-zinc-900">
            {video?.youtube_id && <img src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`} alt="Video keyframe preview" className="h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-105 group-hover:opacity-90" />}
            <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300">FRAME {String(index + 1).padStart(2, '0')}</span>
            <span className="absolute bottom-2 right-2 rounded bg-[#FF3B3B] px-1.5 py-0.5 font-mono text-[9px] text-white">{formatTime(chunk.start_seconds)}</span>
          </div>
          <p className="line-clamp-2 p-2.5 text-[10px] leading-4 text-zinc-400">{chunk.content}</p>
        </button>
      ))}
    </div>
  );

  const renderChat = () => (
    <div className="flex h-full min-h-0 flex-col bg-[#09090b]">
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5">
          {!loading && !error && messages.length === 0 && (
            <div className="animate-rise rounded-2xl border border-white/[0.07] bg-white/[0.025] px-6 py-9 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF3B3B]/10 text-[#FF3B3B]"><Sparkles className="h-4 w-4" /></div>
              <h3 className="mt-3 text-sm font-semibold text-white">Ask this video anything</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-zinc-500">Answers are grounded in the stored transcript and include clickable timestamps.</p>
            </div>
          )}
          {messages.map((message, index) => {
            const key = message.id ?? `${message.role}-${index}`;
            if (message.role === 'user') {
              return <div key={key} className="animate-rise flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md border border-white/[0.08] bg-[#1a1a1f] px-4 py-3 text-xs leading-5 text-zinc-100 shadow-lg">{message.content}</div></div>;
            }
            return (
              <article key={key} className="animate-rise group rounded-2xl border border-white/[0.07] bg-[#111114] p-4 shadow-[0_18px_50px_rgba(0,0,0,.22)] sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FF3B3B]"><WandSparkles className="h-3.5 w-3.5" />Grounded answer</span>
                  <div className="flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
                    <button type="button" onClick={() => void copyAnswer(message, key)} title="Copy answer" className="rounded-lg p-2 text-zinc-600 hover:bg-white/[0.05] hover:text-white">{copiedId === key ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button>
                    <button type="button" onClick={() => exportAnswer(message)} title="Export Markdown" className="rounded-lg p-2 text-zinc-600 hover:bg-white/[0.05] hover:text-white"><Download className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-6 text-zinc-300">{message.content}</p>
                {!!message.citations.length && (
                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600"><Clock3 className="h-3 w-3 text-[#FF3B3B]" />Verifiable source moments</p>
                    <div className="flex flex-wrap gap-2">
                      {message.citations.map((citation) => (
                        <button key={`${key}-${citation.chunk_id}`} type="button" onClick={() => seekTo(citation.start_seconds)} title={citation.content} className="citation-pill inline-flex items-center gap-1.5 rounded-lg border border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.09] px-2.5 py-1.5 font-mono text-[10px] text-[#FF6B70] transition hover:border-[#FF3B3B] hover:bg-[#FF3B3B] hover:text-white"><Play className="h-2.5 w-2.5 fill-current" />[{citation.timestamp_formatted}]</button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {loading && <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#111114] px-4 py-3 text-xs text-zinc-500"><span className="h-2 w-2 animate-ping rounded-full bg-[#FF3B3B]" />Planner is retrieving and grading transcript evidence...</div>}
          {error && <div className="flex items-start justify-between rounded-xl border border-[#FF3B3B]/25 bg-[#FF3B3B]/[0.07] px-4 py-3 text-xs leading-5 text-[#FFB4B7]"><span>{error}</span><button type="button" onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button></div>}
          <div ref={chatEndRef} />
        </div>
      </div>
      <div className="shrink-0 border-t border-white/[0.06] bg-[#09090b]/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
            {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void handleSendQuery(undefined, suggestion)} className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[10px] text-zinc-500 transition hover:border-[#FF3B3B]/30 hover:text-zinc-200">{suggestion}</button>)}
          </div>
          <form onSubmit={(event) => void handleSendQuery(event)} className="flex items-center gap-2 rounded-2xl border border-white/[0.09] bg-[#141417] p-2 pl-4 shadow-xl transition focus-within:border-[#FF3B3B]/35 focus-within:shadow-[0_0_30px_rgba(255,59,59,.07)]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask anything about this video transcript..." className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600" />
            <button type="submit" disabled={!query.trim() || loading} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF3B3B] to-[#C81E2B] text-white shadow-[0_0_20px_rgba(255,59,59,.25)] transition hover:scale-105 disabled:scale-100 disabled:opacity-30"><Send className="h-3.5 w-3.5" /></button>
          </form>
        </div>
      </div>
    </div>
  );

  const player = video?.youtube_id ? (
    <YouTubePlayer ref={playerRef} videoId={video.youtube_id} title={video.title} onTimeChange={handlePlayerTime} />
  ) : null;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#09090b] text-zinc-100">
      <Sidebar chats={chats} activeChatId={activeChatId} collapsed={sidebarCollapsed} mobileOpen={mobileSidebarOpen} userEmail={user?.email} onToggle={() => setSidebarCollapsed((value) => !value)} onCloseMobile={() => setMobileSidebarOpen(false)} onSelectChat={(id) => void handleSelectChat(id)} onNewChat={startNewChat} onLogout={() => void supabase.auth.signOut()} />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0b0b0e]/90 px-3 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-white md:hidden"><Menu className="h-4 w-4" /></button>
            <span className="flex items-center gap-2 text-xs font-semibold text-white"><span className="h-2 w-2 rounded-full bg-[#FF3B3B] shadow-[0_0_12px_rgba(255,59,59,.8)]" />Workspace</span>
            {activeChat && <><ChevronRight className="h-3 w-3 text-zinc-700" /><span className="max-w-[42vw] truncate text-[11px] text-zinc-500">{activeChat.title}</span></>}
          </div>
          <div className="flex items-center gap-2">
            {activeChat && <button type="button" className="hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-zinc-500 transition hover:text-white sm:flex"><Share2 className="h-3 w-3" />Share</button>}
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2.5 py-1.5 font-mono text-[9px] text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />ENGINE ACTIVE</span>
          </div>
        </header>

        {!activeChatId ? (
          <div className="relative flex-1 overflow-y-auto px-4 py-10 sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,59,59,.10),transparent_35%)]" />
            <div className="relative mx-auto max-w-5xl">
              <section className="animate-rise mx-auto max-w-3xl text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF3B3B]/25 bg-[#FF3B3B]/[0.09] shadow-[0_0_50px_rgba(255,59,59,.14)]"><img src={vectorIcon} alt="" className="h-6 w-6 object-contain" /></div>
                <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.25em] text-[#FF5A5F]">Citation-grounded video intelligence</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Turn any YouTube video into a <span className="bg-gradient-to-r from-[#FF6B70] to-[#FF3B3B] bg-clip-text text-transparent">research workspace.</span></h1>
                <p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-zinc-500 sm:text-sm">Watch, search the transcript, and ask questions with answers linked to exact moments in the video.</p>
                <form onSubmit={(event) => void handleIngest(event)} className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl border border-white/[0.08] bg-[#111114]/90 p-2 shadow-2xl backdrop-blur sm:flex-row">
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3"><Video className="h-4 w-4 shrink-0 text-[#FF3B3B]" /><input value={urlInput} onChange={(event) => setUrlInput(event.target.value)} placeholder="Paste a YouTube URL..." className="h-11 min-w-0 flex-1 bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600" /></div>
                  <button type="submit" disabled={!urlInput.trim() || ingesting} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF3B3B] to-[#C81E2B] px-5 text-xs font-semibold text-white shadow-[0_0_25px_rgba(255,59,59,.22)] transition hover:scale-[1.02] disabled:opacity-40"><Sparkles className="h-3.5 w-3.5" />Index video</button>
                </form>
                {error && <p className="mx-auto mt-3 max-w-2xl rounded-xl border border-[#FF3B3B]/20 bg-[#FF3B3B]/[0.06] px-4 py-3 text-xs text-[#FFB4B7]">{error}</p>}
              </section>

              <section className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
                {[
                  ['Millisecond Precision', 'Every AI deduction is strictly bounded to the exact spoken second with 1-click video player timecode synchronization.', Clock3],
                  ['Hybrid BM25 + Dense Search', 'Combines lexical exact-keyword token matching with high-dimensional vector embeddings for hallucination-free quotes.', Layers3],
                  ['Verifiable Source Quotes', 'Export structured notes and Markdown research cards featuring speaker attribution and playback backlinks.', Clipboard],
                ].map(([title, description, Icon]) => {
                  const CardIcon = Icon as typeof Clock3;
                  return <div key={title as string} className="feature-card min-h-[192px] rounded-2xl border border-white/[0.09] bg-[#111114] p-5 sm:p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-[#18181d] text-[#FF3B3B]"><CardIcon className="h-4 w-4" /></div><h2 className="mt-5 text-[13px] font-semibold text-white">{title as string}</h2><p className="mt-2 text-[11px] leading-5 text-zinc-400">{description as string}</p></div>;
                })}
              </section>

              <section className="mt-10 border-t border-white/[0.06] pt-8">
                <div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B3B]">Explore</p><h2 className="mt-1 text-sm font-semibold text-white">Curated technical seminars</h2></div><span className="text-[10px] text-zinc-600">Demo collection · 142 lectures</span></div>
                <div className="grid gap-3 sm:grid-cols-3">{['Agentic RAG & Self-Correction', 'Production LLM Systems', 'Modern Frontend Architecture'].map((title, index) => <div key={title} className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111114]"><div className="relative aspect-video bg-gradient-to-br from-[#FF3B3B]/20 via-zinc-900 to-black"><div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:18px_18px]" /><span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[9px]">{['48:12', '1:14:08', '32:45'][index]}</span></div><div className="p-3"><p className="text-[10px] font-medium text-zinc-300">{title}</p><p className="mt-2 font-mono text-[8px] text-emerald-500">TIMESTAMP INDEX READY</p></div></div>)}</div>
              </section>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <div className="hidden h-full min-h-0 grid-cols-[minmax(420px,50%)_minmax(0,50%)] md:grid">
              <section className="flex min-h-0 flex-col border-r border-white/[0.06] bg-[#0d0d10]">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{video?.title}</p><p className="mt-0.5 text-[10px] text-zinc-600">{video?.channel_name ?? 'YouTube'} · {formatTime(video?.duration_seconds ?? 0)}</p></div><button type="button" onClick={() => setVideoVisible((value) => !value)} className="ml-3 flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[10px] text-zinc-500 hover:text-white">{videoVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{videoVisible ? 'Hide' : 'Show'} video</button></div>
                {videoVisible && <div className="aspect-video shrink-0 border-b border-white/[0.06] bg-black p-3 lg:p-4">{!isMobileViewport && player}</div>}
                <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-3">
                  <div className="flex h-full items-center"><button type="button" onClick={() => setMediaTab('transcript')} className={`flex h-full items-center gap-2 border-b-2 px-3 text-[10px] font-medium ${mediaTab === 'transcript' ? 'border-[#FF3B3B] text-white' : 'border-transparent text-zinc-600'}`}><FileText className="h-3.5 w-3.5" />Transcript</button><button type="button" onClick={() => setMediaTab('keyframes')} className={`flex h-full items-center gap-2 border-b-2 px-3 text-[10px] font-medium ${mediaTab === 'keyframes' ? 'border-[#FF3B3B] text-white' : 'border-transparent text-zinc-600'}`}><Layers3 className="h-3.5 w-3.5" />Keyframes</button></div>
                  {mediaTab === 'transcript' && <label className="relative w-52 max-w-[42%]"><Search className="absolute left-3 top-2.5 h-3 w-3 text-zinc-600" /><input value={transcriptSearch} onChange={(event) => setTranscriptSearch(event.target.value)} placeholder="Search transcript..." className="h-8 w-full rounded-lg border border-white/[0.07] bg-black/20 pl-8 pr-2 text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-[#FF3B3B]/35" /></label>}
                </div>
                <div className="min-h-0 flex-1">{mediaTab === 'transcript' ? renderTranscript(false) : renderKeyframes()}</div>
              </section>
              <section className="min-h-0">{renderChat()}</section>
            </div>

            <div className="flex h-full min-h-0 flex-col md:hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2"><div className="min-w-0"><p className="truncate text-[11px] font-medium text-white">{video?.title}</p><p className="text-[9px] text-zinc-600">{video?.channel_name ?? 'YouTube'}</p></div><button type="button" onClick={() => setVideoVisible((value) => !value)} className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-white">{videoVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
              {videoVisible && <div className="aspect-video max-h-[34vh] shrink-0 bg-black p-2">{isMobileViewport && player}</div>}
              <div className="grid h-11 shrink-0 grid-cols-2 border-y border-white/[0.06] bg-[#0c0c0f] p-1"><button type="button" onClick={() => setMobileTab('chat')} className={`flex items-center justify-center gap-2 rounded-lg text-[10px] font-medium transition ${mobileTab === 'chat' ? 'bg-[#FF3B3B]/10 text-white' : 'text-zinc-600'}`}><Sparkles className="h-3.5 w-3.5" />Chat</button><button type="button" onClick={() => setMobileTab('transcript')} className={`flex items-center justify-center gap-2 rounded-lg text-[10px] font-medium transition ${mobileTab === 'transcript' ? 'bg-[#FF3B3B]/10 text-white' : 'text-zinc-600'}`}><FileText className="h-3.5 w-3.5" />Transcript</button></div>
              <div className="min-h-0 flex-1">{mobileTab === 'chat' ? renderChat() : renderTranscript()}</div>
            </div>
          </div>
        )}
      </main>

      {ingesting && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><div className="animate-rise w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111114] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#FF3B3B]">CiteTube engine</p><h3 className="mt-1 text-sm font-semibold text-white">Indexing video transcript</h3></div><span className="rounded-full border border-[#FF3B3B]/25 bg-[#FF3B3B]/[0.08] px-2.5 py-1 font-mono text-[10px] text-[#FF6B70]">{Math.min(100, (ingestionStep + 1) * 25)}%</span></div><div className="mt-5 space-y-2">{PIPELINE_STEPS.map((step, index) => <div key={step} className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-xs transition-all ${index === ingestionStep ? 'border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.06] text-white' : index < ingestionStep ? 'border-white/[0.06] bg-white/[0.02] text-zinc-400' : 'border-white/[0.04] text-zinc-700'}`}>{index < ingestionStep ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <span className={`h-2 w-2 rounded-full ${index === ingestionStep ? 'animate-ping bg-[#FF3B3B]' : 'bg-zinc-800'}`} />}{step}</div>)}</div></div></div>}
    </div>
  );
}
