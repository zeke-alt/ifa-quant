"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { analyzeMarkets } from "@/lib/api-client";
import { MacroSignal } from "@/types/macro";
import { Send, Loader2, Zap, TrendingUp, AlertTriangle, BarChart2, Info } from "lucide-react";
import { useLayout } from "@/context/LayoutContext";
import { cn } from "@/lib/utils";

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
  const { isSidebarCollapsed } = useLayout();

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
            <li key={i} className="ml-4 list-disc text-muted-foreground mb-1">
              {renderLineParts(line.slice(2))}
            </li>
          );
        }

        // Handle full-line bold headers
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-black text-foreground mb-2 mt-4 first:mt-0">
              {renderLineParts(line.slice(2, -2))}
            </p>
          );
        }

        return (
          <p key={i} className="text-muted-foreground mb-2">
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
          <strong key={j} className="text-foreground font-black">
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
              className="text-primary hover:underline font-black transition-colors"
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
            className="text-primary hover:underline break-all transition-colors"
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
    <div className="min-h-screen bg-background text-foreground transition-all duration-300">
      <Sidebar />

      <main className={cn(
        "flex flex-col h-screen transition-all duration-500 ease-in-out pt-16 lg:pt-0",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        {/* Header */}
        <div className="shrink-0 border-b border-border px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-orange-500 to-amber-600 flex items-center justify-center text-lg font-black text-white shadow-lg shadow-orange-500/20">
                Ọ
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight uppercase">Ifá Oracle</h1>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest font-bold">
                {signalsLoading ? "LOADING_SIGNALS..." : `${signals.length}_SIGNALS_LOADED // LIVE`}
              </p>
            </div>
          </div>

          {/* Signal summary pills */}
          <div className="hidden md:flex gap-2">
            {[
              { label: "BULLISH", count: signals.filter(s => s.sentiment === "BULLISH").length, color: "text-green-500 bg-green-500/10 border-green-500/20" },
              { label: "BEARISH", count: signals.filter(s => s.sentiment === "BEARISH").length, color: "text-red-500 bg-red-500/10 border-red-500/20" },
              { label: "RISK", count: signals.filter(s => s.sentiment === "RISK_ALERT").length, color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
            ].map(({ label, count, color }) => (
              <div key={label} className={`text-[10px] font-black px-3 py-1.5 rounded-xl border ${color}`}>
                {label}: {count}
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-8 no-scrollbar">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div className={cn(
                "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-sm",
                msg.role === "assistant"
                  ? "bg-linear-to-br from-orange-500 to-amber-600 text-white"
                  : "bg-secondary text-muted-foreground"
              )}>
                {msg.role === "assistant" ? "Ọ" : "U"}
              </div>

              {/* Bubble */}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-6 py-4 text-sm leading-relaxed shadow-sm",
                msg.role === "assistant"
                  ? "bg-card border border-border text-foreground/90 font-medium"
                  : "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/10"
              )}>
                {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-orange-500 to-amber-600 flex items-center justify-center text-xs font-black text-white shrink-0">
                Ọ
              </div>
              <div className="bg-card border border-border rounded-2xl px-6 py-4 flex items-center gap-3 shadow-sm">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">CONSULTING_IFA...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts */}
        {messages.length === 1 && (
          <div className="px-4 md:px-12 pb-6">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-[10px] font-black text-muted-foreground bg-secondary hover:bg-muted border border-border hover:border-primary/30 hover:text-primary px-4 py-2 rounded-2xl transition-all shadow-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-border px-4 md:px-12 pt-6 pb-12 md:pb-6 bg-background/80 backdrop-blur-xl">
          <div className="flex gap-4 items-end max-w-4xl mx-auto">
            <div className="flex-1 bg-card border border-border focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5 rounded-2xl px-5 py-4 transition-all shadow-sm">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Ifa anything about the markets..."
                rows={1}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 resize-none outline-none font-medium no-scrollbar"
                style={{ maxHeight: "120px" }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="w-12 h-12 rounded-2xl bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground flex items-center justify-center transition-all shadow-lg shadow-primary/20 shrink-0"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-center text-[9px] font-black text-muted-foreground mt-4 uppercase tracking-[0.3em] opacity-40">
            IFA_ORACLE // POWERED BY GEMINI + LIVE BAYSE DATA // OJA INTELLIGENCE
          </p>
        </div>
      </main>
    </div>
  );
}
