import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Send, Bot, User, Loader2, Cpu,
  Search, Lightbulb, Crosshair, Zap,
} from "lucide-react";

// ── Message bubble ────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isEngine = msg.type === "engine" || msg.type === "engine-query";
  const isUser   = msg.role  === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center
          ${isEngine ? "bg-cyan-500/15" : "bg-primary/10"}`}>
          {isEngine
            ? <Cpu   className="h-3.5 w-3.5 text-cyan-400" />
            : <Bot   className="h-3.5 w-3.5 text-primary" />}
        </div>
      )}
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
        isUser
          ? (msg.type === "engine-query"
              ? "bg-cyan-500/20 text-cyan-100 border border-cyan-500/30"
              : "bg-primary text-primary-foreground")
          : (isEngine
              ? "bg-cyan-950/60 text-cyan-50 border border-cyan-800/40 font-mono text-xs"
              : "bg-secondary text-secondary-foreground")
      }`}>
        {msg.content}
      </div>
      {isUser && (
        <div className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────
function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  coachMode = "engine",
  onCoachModeChange,
  isLiveMode = false,
  onEngineAnalyze,
  onEngineBestMove,
  onEngineHint,
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const [activeTab, setActiveTab] = useState(coachMode === "ai" ? "ai" : "engine");

  function handleTabClick(tab) {
    setActiveTab(tab);
    onCoachModeChange?.(tab);
  }

  // Keep tab in sync if coachMode is changed externally
  useEffect(() => {
    if (coachMode !== activeTab) setActiveTab(coachMode);
  }, [coachMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const visibleMessages = messages.filter((m) => {
    if (activeTab === "engine") return m.type === "engine" || m.type === "engine-query";
    if (activeTab === "ai")     return m.type !== "engine" && m.type !== "engine-query";
    return false;
  });

  const tabs = [
    { id: "engine", icon: Cpu, label: "Engine", iconCls: "text-cyan-400" },
    { id: "ai",     icon: Bot, label: "AI Coach" },
  ];

  return (
    <div className="flex flex-col h-full border-l border-border bg-card">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map(({ id, icon: Icon, label, iconCls }) => {
          const isActive = activeTab === id;
          return (
            <button key={id}
              onClick={() => handleTabClick(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors border-b-2 flex-1 justify-center ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive && iconCls ? iconCls : ""}`} />
              <span>{label}</span>
              {id === "engine" && isLiveMode && (
                <span className="ml-0.5 inline-flex items-center gap-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded-full px-1.5 py-0.5 leading-none">
                  <Zap className="h-2.5 w-2.5" />Live
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            {activeTab === "engine" ? (
              <>
                <Cpu className="h-10 w-10 mb-3 opacity-20 text-cyan-400" />
                <p className="text-sm">Stockfish Engine Coach</p>
                <p className="text-xs mt-1">
                  {isLiveMode
                    ? "Live analysis is on — analysis appears after each move."
                    : "Use the buttons below to analyze the position."}
                </p>
              </>
            ) : (
              <>
                <Bot className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">AI Coach</p>
                <p className="text-xs mt-1">Ask me anything about the position!</p>
              </>
            )}
          </div>
        )}

        {visibleMessages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center
              ${activeTab === "engine" ? "bg-cyan-500/15" : "bg-primary/10"}`}>
              {activeTab === "engine"
                ? <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                : <Bot className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className="bg-secondary rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {activeTab === "engine" ? "Calculating…" : "Thinking…"}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom action area */}
      {activeTab === "engine" ? (
        <div className="p-3 border-t border-border space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEngineAnalyze}
              disabled={isLoading}
              className="flex flex-col h-auto py-2 gap-1 border-cyan-800/40 hover:bg-cyan-950/40 hover:border-cyan-600/60"
            >
              <Search className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] text-cyan-300">Analyze</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEngineBestMove}
              disabled={isLoading}
              className="flex flex-col h-auto py-2 gap-1 border-cyan-800/40 hover:bg-cyan-950/40 hover:border-cyan-600/60"
            >
              <Lightbulb className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] text-cyan-300">Best Move</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEngineHint}
              disabled={isLoading}
              className="flex flex-col h-auto py-2 gap-1 border-cyan-800/40 hover:bg-cyan-950/40 hover:border-cyan-600/60"
            >
              <Crosshair className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] text-cyan-300">Hint</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your AI coach…"
              disabled={isLoading}
              className="flex-1"
            />
            <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPanel;
