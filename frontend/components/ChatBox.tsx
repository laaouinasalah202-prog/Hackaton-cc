"use client";

import { useState } from "react";
import { MessageSquare, Send, Sparkles, User, Bot, Loader2 } from "lucide-react";
import { sendChatMessage } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  referenced_services?: string[];
}

interface Props {
  sessionId: string;
}

const SUGGESTED_QUERIES = [
  "What is the root cause of this incident?",
  "Which service started failing first?",
  "Why did the API Gateway return 504 errors?",
  "What should engineering do to prevent this recurrence?",
];

export function ChatBox({ sessionId }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your LogLens AI copilot powered by Gemma. Ask me any question about anomalies, service dependencies, error spikes, or root causes across your uploaded logs.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await sendChatMessage(sessionId, textToSend);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: resp.answer,
          referenced_services: resp.referenced_services,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an issue analyzing your query. Please verify backend status.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm flex flex-col h-[520px]">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-400">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              Gemma LogCopilot Chat
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            </h3>
            <p className="text-[11px] text-slate-400">
              Interactive natural language questions grounded in unified log telemetry.
            </p>
          </div>
        </div>
      </div>

      {/* Suggested prompts chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SUGGESTED_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            disabled={isLoading}
            className="rounded-full bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-indigo-600/30 hover:text-indigo-200 hover:border-indigo-500/30 border border-slate-700/60 transition-all text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="h-6 w-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-lg p-3 leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none"
              }`}
            >
              {m.content}

              {m.referenced_services && m.referenced_services.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-400">Cited Services:</span>
                  {m.referenced_services.map((svc) => (
                    <span
                      key={svc}
                      className="rounded bg-indigo-950/80 px-1.5 py-0.5 text-[9px] font-mono text-indigo-300 border border-indigo-500/30"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {m.role === "user" && (
              <div className="h-6 w-6 rounded-md bg-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-indigo-400 text-xs py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Consulting Gemma 3 log model...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mt-3 flex gap-2 pt-2 border-t border-slate-800/80"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the logs or incident..."
          disabled={isLoading}
          className="flex-1 rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-white placeholder-slate-500 border border-slate-700/80 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
