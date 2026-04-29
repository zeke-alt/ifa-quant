"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { analyzeMarkets } from "@/lib/api-client";
import { MacroSignal } from "@/types/macro";
import { Send, Loader2, Zap, TrendingUp, AlertTriangle, BarChart2, Info, Activity, BrainCircuit } from "lucide-react";
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
];

export default function OraclePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Ẹ káàbọ̀. I am **Ifa** — the macroeconomic oracle of Oja Intelligence.\n\nI have access to your live Bayse market signals, trade scores, and AI reasoning. Ask me anything about current market opportunities, signal reliability, or Nigerian macro conditions.`,
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

  useEffect(() => {
    analyzeMarkets()
      .then((data) => setSignals(data.signals ?? []))
      .catch(console.error)
      .finally(() => setSignalsLoading(false));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("oja_trade_history");
      if (saved) setTradeHistory(JSON.parse(saved));
    } catch {}
  }, []);

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

  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.trim() === "") return <br key={i} />;
      if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc text-muted-foreground mb-1 font-mono text-[11px]">{renderLineParts(line.slice(2))}</li>;
      return <p key={i} className="text-muted-foreground mb-2 font-mono text-[11px] leading-relaxed">{renderLineParts(line)}</p>;
    });
  };

  const renderLineParts = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\)|https?:\/\/[^\s]+)/g);
    return parts.map((part, j) => {
      if (!part) return null;
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={j} className="text-foreground font-bold">{part.slice(2, -2)}</strong>;
      if (part.startsWith("[") && part.includes("](")) {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) return <a key={j} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">{match[1]}</a>;
      }
      if (part.startsWith("http")) return <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{part}</a>;
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-all duration-300 selection:bg-primary/20">
      <Sidebar />

      <main className={cn(
        "flex flex-col h-screen transition-all duration-300 pt-16 lg:pt-0",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        {/* Header */}
        <div className="shrink-0 border-b border-border px-6 py-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-orange-500/40 bg-background flex items-center justify-center text-lg font-bold text-orange-500">
              Ọ
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-widest uppercase">Ifá Oracle</h1>
              <p className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">
                {signalsLoading ? "INITIALIZING_NODES..." : `${signals.length}_SIGNALS_LOADED // LIVE_ACCESS`}
              </p>
            </div>
          </div>

          <div className="hidden md:flex gap-3">
            {[
              { label: "BULLISH", count: signals.filter(s => s.sentiment === "BULLISH").length, color: "text-emerald-500 bg-emerald-500/5 border-emerald-500/10" },
              { label: "BEARISH", count: signals.filter(s => s.sentiment === "BEARISH").length, color: "text-rose-500 bg-rose-500/5 border-rose-500/10" },
              { label: "RISK", count: signals.filter(s => s.sentiment === "RISK_ALERT").length, color: "text-orange-500 bg-orange-500/5 border-orange-500/10" },
            ].map(({ label, count, color }) => (
              <div key={label} className={cn("text-[9px] font-bold px-3 py-1 border uppercase tracking-widest", color)}>
                {label}: {count}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Space */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-12 py-8 space-y-8 no-scrollbar bg-accent/10">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-4 max-w-4xl mx-auto", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div className={cn(
                "shrink-0 w-8 h-8 border flex items-center justify-center text-xs font-bold",
                msg.role === "assistant" ? "bg-orange-500/10 border-orange-500/30 text-orange-500" : "bg-card border-border text-muted-foreground"
              )}>
                {msg.role === "assistant" ? "Ọ" : "U"}
              </div>
              <div className={cn(
                "p-5 border relative",
                msg.role === "assistant" ? "bg-card border-border text-foreground" : "bg-primary text-primary-foreground border-primary font-bold shadow-lg"
              )}>
                {msg.role === "assistant" ? (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500/40" />
                    {renderContent(msg.content)}
                  </>
                ) : (
                  <p className="text-[11px] font-mono leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-4 max-w-4xl mx-auto">
              <div className="w-8 h-8 border border-orange-500/40 bg-card flex items-center justify-center text-xs font-bold text-orange-500 shrink-0">Ọ</div>
              <div className="bg-card border border-border p-5 flex items-center gap-3">
                 <Loader2 size={14} className="animate-spin text-orange-500" />
                 <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.4em]">CONSULTING_IFA_LEDGER...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input & Suggestions */}
        <div className="shrink-0 border-t border-border p-6 bg-card">
          <div className="max-w-4xl mx-auto">
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)} className="text-[9px] font-bold text-muted-foreground border border-border px-3 py-1.5 hover:border-primary/40 hover:text-primary transition-all uppercase tracking-widest bg-accent/20">
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex gap-4 items-end">
              <div className="flex-1 bg-background border border-border focus-within:border-primary/50 p-4 transition-all shadow-inner">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Ifa Oracle..."
                  rows={1}
                  className="w-full bg-transparent text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 resize-none outline-none no-scrollbar"
                  style={{ maxHeight: "120px" }}
                />
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="w-12 h-12 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground flex items-center justify-center transition-all shrink-0 shadow-lg"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            
            <div className="mt-4 flex items-center justify-center gap-6">
               <div className="flex items-center gap-2">
                  <Activity size={10} className="text-muted-foreground/40" />
                  <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em]">Neural_Inference_Stream</p>
               </div>
               <div className="flex items-center gap-2">
                  <BrainCircuit size={10} className="text-muted-foreground/40" />
                  <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em]">Vertex_AI_Optimized</p>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
