import { useState, useEffect } from 'react';
import { 
  Send, 
  Clock, 
  Sparkles, 
  Sliders, 
  Layers, 
  Zap, 
  FileText, 
  ChevronRight, 
  Quote, 
  CheckCircle2, 
  Clipboard, 
  Search,
  Check
} from 'lucide-react';
import { fetcher } from '../../lib/api';
import { supabase } from '../../lib/auth';
import Sidebar from '../sidebar/Sidebar';
import vectorIcon from '../../assets/Vector.png';

export default function ChatInterface() {
  const [user, setUser] = useState<any>(null);
  const [urlInput, setUrlInput] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [videoData, setVideoData] = useState<any>(null);
  const [chats, setChats] = useState<Array<{ id: string; title: string }>>([
    { id: '1', title: 'What Is Agentic RAG?' },
    { id: '2', title: 'Backends for Frontends Explained' },
    { id: '3', title: 'Designing LLM Orchestrators' },
    { id: '4', title: 'Vector Search Deep Dive' },
    { id: '5', title: 'Graph RAG & Reasoning' },
  ]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string; citations?: any[] }>>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Ingestion Toggle Toggles
  const [deepIndexing, setDeepIndexing] = useState(true);
  const [speakerDiarization, setSpeakerDiarization] = useState(true);
  const [visualSlides, setVisualSlides] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
        fetchUserChats(user.id);
      }
    });
  }, []);

  const fetchUserChats = async (userId: string) => {
    try {
      const data = await fetcher(`/chats?user_id=${userId}`);
      if (data && data.length > 0) setChats(data);
    } catch (err) {
      console.error('Failed to load chats', err);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput || !user) return;
    setIngesting(true);
    try {
      const videoRes = await fetcher('/videos/ingest', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
      });
      setVideoData(videoRes);

      const chatRes = await fetcher('/chats', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          video_id: videoRes.id,
        }),
      });

      setActiveChatId(chatRes.id);
      setChats((prev) => [chatRes, ...prev]);
      setMessages([
        {
          role: 'assistant',
          content: `Successfully ingested **${videoRes.title || 'Video'}**. Ask me anything about it!`,
        },
      ]);
    } catch (err: any) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  const handleSelectChat = async (chatId: string) => {
    setActiveChatId(chatId);
    setLoading(true);
    try {
      const msgs = await fetcher(`/messages/${chatId}?user_id=${user?.id}`);
      setMessages(
        msgs.map((m: any) => ({
          role: m.role,
          content: m.content,
          citations: m.message_metadata?.citations || [],
        }))
      );
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || !activeChatId || !user) return;

    const userMsg = query;
    setQuery('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetcher('/chats/query', {
        method: 'POST',
        body: JSON.stringify({
          chat_id: activeChatId,
          user_id: user.id,
          query: userMsg,
        }),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          citations: res.citations,
        },
      ]);
    } catch (err: any) {
      alert(`Query failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0D0D0E] text-neutral-200 flex-1 overflow-hidden font-sans">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={() => {
          setActiveChatId(null);
          setVideoData(null);
          setMessages([]);
        }}
        onLogout={() => supabase.auth.signOut()}
      />

      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-12 items-center justify-between border-b border-[#232326] px-6 text-xs bg-[#0D0D0E]">
          <div className="flex items-center space-x-2 text-neutral-400">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              Workspace
            </span>
            <ChevronRight className="h-3 w-3 text-neutral-600" />
            <span className="text-neutral-400">Retrieval Canvas</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#18181B] border border-[#27272A] px-2.5 py-1 text-[11px] font-mono text-cyan-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Engine Active
            </span>
            <div className="h-6 w-6 rounded-full bg-neutral-700 flex items-center justify-center font-semibold text-white text-[10px]">
              AV
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          {!videoData && !activeChatId ? (
            <div className="max-w-5xl mx-auto space-y-12">
              {/* Hero Banner Section */}
              <div className="text-center space-y-3 pt-4">
                <div className="inline-flex items-center gap-2 text-[11px] font-mono text-neutral-400 bg-[#161618] border border-[#232326] px-3 py-1 rounded-full">
                  <Zap className="h-3 w-3 text-red-500" />
                  <span>CiteTube Engine v2.4</span>
                  <span className="text-neutral-600">/</span>
                  <span className="text-neutral-400">Timestamp Grounded RAG</span>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight text-white font-sans">
                  Chat with any <span className="bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text text-transparent">YouTube Video</span>
                </h1>
                
                <p className="text-sm text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                  Index transcripts, parse visual keyframes, and query multi-hour lectures with millisecond citations and hybrid vector retrieval.
                </p>
              </div>

              {/* Ingestion Input Box */}
              <div className="max-w-3xl mx-auto bg-[#141416] rounded-2xl border border-[#232326] p-4 shadow-2xl">
                <form onSubmit={handleIngest} className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <img src={vectorIcon} alt="YT" className="absolute left-3.5 top-3 h-4 w-4 opacity-70" />
                    <input
                      type="url"
                      required
                      placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="w-full rounded-xl bg-[#0D0D0E] border border-[#232326] pl-10 pr-24 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.readText().then(text => setUrlInput(text))}
                      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#1C1C1F] border border-[#2E2E33] px-2 py-1 text-[11px] font-mono text-neutral-300 hover:text-white transition"
                    >
                      <Clipboard className="h-3 w-3" /> Paste
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={ingesting}
                    className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shrink-0 shadow-lg shadow-red-900/20"
                  >
                    <Zap className="h-3.5 w-3.5 fill-current" />
                    {ingesting ? 'Processing...' : 'Ingest Video'}
                  </button>
                </form>

                {/* Toggle Controls */}
                <div className="flex flex-wrap items-center gap-6 px-1 text-xs text-neutral-400 font-sans">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deepIndexing}
                      onChange={() => setDeepIndexing(!deepIndexing)}
                      className="rounded accent-red-500 bg-[#0D0D0E] border-[#232326]"
                    />
                    <span>Deep Transcript Indexing</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={speakerDiarization}
                      onChange={() => setSpeakerDiarization(!speakerDiarization)}
                      className="rounded accent-red-500 bg-[#0D0D0E] border-[#232326]"
                    />
                    <span>Speaker Diarization</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visualSlides}
                      onChange={() => setVisualSlides(!visualSlides)}
                      className="rounded accent-red-500 bg-[#0D0D0E] border-[#232326]"
                    />
                    <span className="flex items-center gap-1.5">
                      Visual Slides
                      <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1 py-0.2 rounded font-mono font-semibold">BETA</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* 3 Feature Highlights Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <div className="bg-[#141416] border border-[#232326] rounded-xl p-4 text-left space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-[#1C1C1F] border border-[#2A2A2E] flex items-center justify-center text-neutral-300">
                    <Clock className="h-4 w-4 text-neutral-300" />
                  </div>
                  <h3 className="text-xs font-bold text-white font-sans">Millisecond Precision</h3>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Every AI deduction is strictly bounded to the exact spoken second with 1-click video player timecode synchronization.
                  </p>
                </div>

                <div className="bg-[#141416] border border-[#232326] rounded-xl p-4 text-left space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-[#1C1C1F] border border-[#2A2A2E] flex items-center justify-center text-cyan-400">
                    <Layers className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-white font-sans">Hybrid BM25 + Dense Search</h3>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Combines lexical exact-keyword token matching with high-dimensional vector embeddings for hallucination-free quotes.
                  </p>
                </div>

                <div className="bg-[#141416] border border-[#232326] rounded-xl p-4 text-left space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-[#1C1C1F] border border-[#2A2A2E] flex items-center justify-center text-rose-400">
                    <Quote className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-white font-sans">Verifiable Source Quotes</h3>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Export structured notes and Markdown research cards featuring speaker attribution and playback backlinks.
                  </p>
                </div>
              </div>

              {/* Curated Technical Seminars Section */}
              <div className="max-w-4xl mx-auto pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white font-sans">Curated Technical Seminars</h2>
                    <p className="text-xs text-neutral-400">Click any verified lecture to explore immediate timestamp-anchored Q&A.</p>
                  </div>
                  <a href="#all" className="text-xs text-neutral-400 hover:text-white transition flex items-center gap-1">
                    View all 142 lectures <ChevronRight className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1 */}
                  <div className="group bg-[#141416] border border-[#232326] rounded-xl overflow-hidden hover:border-neutral-600 transition cursor-pointer">
                    <div className="relative aspect-video bg-neutral-800 overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80" 
                        alt="Lecture Thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                        Featured
                      </span>
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded">
                        48:12
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      <span className="text-[10px] font-mono text-rose-400 block">a16z AI Summit</span>
                      <h4 className="text-xs font-bold text-white leading-snug font-sans group-hover:text-red-400 transition">
                        Agentic RAG: Multi-Agent Architectures & Real-world Retrieval
                      </h4>
                      <div className="flex items-center justify-between pt-1 border-t border-[#232326] text-[10px] font-mono text-neutral-400">
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> 1,240 chunks</span>
                        <span className="text-emerald-400 font-semibold">99.4% precision</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="group bg-[#141416] border border-[#232326] rounded-xl overflow-hidden hover:border-neutral-600 transition cursor-pointer">
                    <div className="relative aspect-video bg-neutral-800 overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80" 
                        alt="Lecture Thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded">
                        1:14:08
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      <span className="text-[10px] font-mono text-neutral-400 block">Andrej Karpathy</span>
                      <h4 className="text-xs font-bold text-white leading-snug font-sans group-hover:text-red-400 transition">
                        Building Production LLM Systems: Attention, KV-Cache & Scale
                      </h4>
                      <div className="flex items-center justify-between pt-1 border-t border-[#232326] text-[10px] font-mono text-neutral-400">
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> 2,890 chunks</span>
                        <span className="text-emerald-400 font-semibold">99.8% precision</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="group bg-[#141416] border border-[#232326] rounded-xl overflow-hidden hover:border-neutral-600 transition cursor-pointer">
                    <div className="relative aspect-video bg-neutral-800 overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80" 
                        alt="Lecture Thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded">
                        32:45
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      <span className="text-[10px] font-mono text-neutral-400 block">Theo - t3.gg</span>
                      <h4 className="text-xs font-bold text-white leading-snug font-sans group-hover:text-red-400 transition">
                        Modern Frontend Architecture & Backends For Frontends
                      </h4>
                      <div className="flex items-center justify-between pt-1 border-t border-[#232326] text-[10px] font-mono text-neutral-400">
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> 820 chunks</span>
                        <span className="text-emerald-400 font-semibold">98.9% precision</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Footer Info Bar */}
              <div className="flex flex-wrap items-center justify-between border-t border-[#232326] pt-6 text-[11px] font-mono text-neutral-500">
                <div className="flex items-center gap-4">
                  <span>Latency: <strong className="text-neutral-300 font-normal">184ms P95</strong></span>
                  <span>•</span>
                  <span>Embedding Model: <strong className="text-neutral-300 font-normal">text-embedding-3-large</strong></span>
                </div>
                <div className="flex items-center gap-4">
                  <a href="#api" className="hover:text-neutral-300 transition">API Reference</a>
                  <a href="#cli" className="hover:text-neutral-300 transition">CLI Ingestion</a>
                  <a href="#sandbox" className="hover:text-neutral-300 transition">Security Sandbox</a>
                </div>
              </div>
            </div>
          ) : (
            /* Active Chat View */
            <div className="mx-auto flex h-full max-w-3xl flex-col justify-between">
              <div className="space-y-6 overflow-y-auto pb-6">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs ${
                        msg.role === 'user'
                          ? 'bg-[#1F1F23] text-white border border-[#2C2C32]'
                          : 'bg-[#141416] text-neutral-200 border border-[#232326]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed font-sans">{msg.content}</p>

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 border-t border-[#232326] pt-2.5">
                          <p className="text-[11px] font-medium text-neutral-400 mb-2 flex items-center gap-1 font-sans">
                            <Clock className="h-3 w-3 text-red-400" /> Timestamp Grounded Citations
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.citations.map((cite: any, idx: number) => (
                              <a
                                key={idx}
                                href={cite.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-md bg-[#0D0D0E] px-2 py-1 text-[11px] font-mono text-cyan-400 hover:border-cyan-500 border border-[#232326] transition"
                              >
                                {cite.timestamp_formatted || `[${idx + 1}] Timestamp`}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-[#141416] px-4 py-3 text-xs text-neutral-400 border border-[#232326] animate-pulse font-mono">
                      Retrieving vectors and generating grounded response...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Prompt Box */}
              <form onSubmit={handleSendQuery} className="relative mt-2">
                <input
                  type="text"
                  placeholder="Ask anything about this video transcript..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-xl bg-[#141416] border border-[#232326] py-3.5 pl-4 pr-12 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 font-sans"
                />
                <button
                  type="submit"
                  disabled={loading || !query}
                  className="absolute right-2.5 top-2.5 rounded-lg bg-red-600 p-2 text-white transition hover:bg-red-500 disabled:opacity-30"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}