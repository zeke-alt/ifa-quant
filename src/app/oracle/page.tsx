"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { analyzeMarkets } from "@/lib/api-client";
import { MacroSignal } from "@/types/macro";
import { Send, Loader2, Zap, TrendingUp, AlertTriangle, BarChart2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TradeRecord {
  market_question: string;
  action: string;
  score: number;
  timestamp: string;
}

const SUGGESTED_PROMPTS = [
  "What's the best trade opportunity right now?",
  "Which signals have the highest reliability?",
  "Explain the CBN rate decision signal",
  "Which markets should I avoid today?",
  "What's the overall macro sentiment for Nigeria?",
  "Compare BULLISH signals and rank them",
];

export default function OraclePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Ẹ káàbọ̀. I am **Ifa** — the macroeconomic oracle of Oja Intelligence.\n\nI have access to your live Bayse market signals, trade scores, and AI reasoning. Ask me anything about current market opportunities, signal reliability, or Nigerian macro conditions.\n\n*What would you like to know?*`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<MacroSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load signals
  useEffect(() => {
    analyzeMarkets()
      .then((data) => setSignals(data.signals ?? []))
      .catch(console.error)
      .finally(() => setSignalsLoading(false));
  }, []);

  // Load trade history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("oja_trade_history");
      if (saved) setTradeHistory(JSON.parse(saved));
    } catch {}
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          signals,
          tradeHistory,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        throw new Error("No reply");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Oracle connection failed. Check your Vertex AI credentials." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, signals, tradeHistory, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Improved markdown-ish renderer
  const renderContent = (text: string) => {
    return text
      .split("\n")
      .map((line, i) => {
        if (line.trim() === "") return <br key={i} />;
        
        // Handle list items
        if (line.startsWith("- ")) {
          return (
            <li key={i} className="ml-4 list-disc text-slate-300 mb-1">
              {renderLineParts(line.slice(2))}
            </li>
          );
        }

        // Handle full-line bold headers
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-bold text-white mb-2 mt-4 first:mt-0">
              {renderLineParts(line.slice(2, -2))}
            </p>
          );
        }

        return (
          <p key={i} className="text-slate-300 mb-2">
            {renderLineParts(line)}
          </p>
        );
      });
  };

  // Helper to render inline elements (bold, links, raw URLs)
  const renderLineParts = (line: string) => {
    // Regex to split by Markdown links [text](url), Bold **text**, or raw URLs
    const parts = line.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\)|https?:\/\/[^\s]+)/g);
    
    return parts.map((part, j) => {
      if (!part) return null;

      // Handle Bold
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} className="text-white font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Handle Markdown Links [text](url)
      if (part.startsWith("[") && part.includes("](")) {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          return (
            <a 
              key={j} 
              href={match[2]} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:text-blue-300 hover:underline font-bold transition-colors"
            >
              {match[1]}
            </a>
          );
        }
      }

      // Handle Raw URLs
      if (part.startsWith("http")) {
        return (
          <a 
            key={j} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-400 hover:text-blue-300 hover:underline break-all transition-colors"
          >
            {part}
          </a>
        );
      }

      // Plain text
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Sidebar />

      <main className="lg:ml-64 flex flex-col h-screen">
        {/* Header */}
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-950/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-sm font-black text-white">
                Ọ
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-950" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight uppercase">Ifa Oracle</h1>
              <p className="text-[9px] font-mono text-slate-500 tracking-widest">
                {signalsLoading ? "LOADING_SIGNALS..." : `${signals.length}_SIGNALS_LOADED // LIVE`}
              </p>
            </div>
          </div>

          {/* Signal summary pills */}
          <div className="hidden md:flex gap-2">
            {[
              { label: "BULLISH", count: signals.filter(s => s.sentiment === "BULLISH").length, color: "text-green-400 bg-green-500/10 border-green-500/20" },
              { label: "BEARISH", count: signals.filter(s => s.sentiment === "BEARISH").length, color: "text-red-400 bg-red-500/10 border-red-500/20" },
              { label: "RISK", count: signals.filter(s => s.sentiment === "RISK_ALERT").length, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
            ].map(({ label, count, color }) => (
              <div key={label} className={`text-[9px] font-mono font-bold px-2 py-1 rounded-lg border ${color}`}>
                {label}: {count}
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-12 py-8 space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${
                msg.role === "assistant"
                  ? "bg-gradient-to-br from-orange-500 to-amber-600 text-white"
                  : "bg-slate-700 text-slate-300"
              }`}>
                {msg.role === "assistant" ? "Ọ" : "U"}
              </div>

              {/* Bubble */}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed space-y-1 ${
                msg.role === "assistant"
                  ? "bg-slate-900 border border-slate-800 text-slate-300"
                  : "bg-blue-600 text-white"
              }`}>
                {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                Ọ
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-slate-500">CONSULTING_IFA...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts */}
        {messages.length === 1 && (
          <div className="px-4 md:px-12 pb-4">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-700 hover:border-orange-500/50 hover:text-orange-400 px-3 py-1.5 rounded-xl transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-slate-800 px-4 md:px-12 py-4 bg-slate-950/80 backdrop-blur-xl">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 bg-slate-900 border border-slate-700 focus-within:border-orange-500/50 rounded-2xl px-4 py-3 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Ifa anything about the markets..."
                rows={1}
                className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none outline-none font-mono"
                style={{ maxHeight: "120px" }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white" />}
            </button>
          </div>
          <p className="text-center text-[9px] font-mono text-slate-600 mt-2">
            IFA_ORACLE // POWERED BY GEMINI + LIVE BAYSE DATA // OJA INTELLIGENCE
          </p>
        </div>
      </main>
    </div>
  );
}
