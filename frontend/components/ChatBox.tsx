"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  MessageSquare,
  Send,
  Sparkles,
  User,
  Bot,
  Loader2,
  Copy,
  Check,
  Terminal,
} from "lucide-react";
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

function cleanMarkdownText(content: string): string {
  if (!content) return "";
  return content
    .replace(/\$\\rightarrow\$/g, "→")
    .replace(/\\rightarrow/g, "→")
    .replace(/\$\\leftarrow\$/g, "←")
    .replace(/\\leftarrow/g, "←")
    .replace(/\$\\dots\$/g, "...")
    .replace(/\\dots/g, "...")
    .trim();
}

function AssistantMarkdown({ content }: { content: string }) {
  const cleaned = cleanMarkdownText(content);

  return (
    <div className="text-xs leading-relaxed text-slate-200">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-white mt-3 mb-2 border-b border-slate-700/50 pb-1 flex items-center gap-1.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-white mt-3 mb-1.5 border-b border-slate-700/40 pb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-indigo-300 mt-2.5 mb-1 flex items-center gap-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-semibold text-cyan-300 mt-2 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed text-slate-200 last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-4 space-y-1 mb-2.5 text-slate-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-4 space-y-1 mb-2.5 text-slate-200">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-slate-200 marker:text-indigo-400">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white bg-slate-800/40 px-1 py-0.5 rounded border border-slate-700/40">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="text-slate-300 italic">{children}</em>
          ),
          code: ({ className, children, ...rest }: any) => {
            const isCodeBlock =
              Boolean(className) ||
              (typeof children === "string" && children.includes("\n"));

            if (isCodeBlock) {
              return (
                <div className="my-2 rounded-lg bg-black/90 p-3 font-mono text-[11px] text-emerald-300 border border-slate-800 overflow-x-auto">
                  <code>{children}</code>
                </div>
              );
            }

            return (
              <code className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300 border border-slate-700/70">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500 bg-indigo-950/20 px-3 py-1.5 my-2 italic text-slate-300 rounded-r">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full border-collapse border border-slate-700 text-left text-[11px]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-700 bg-slate-800/80 p-2 font-semibold text-white">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-700/60 p-2 text-slate-300">
              {children}
            </td>
          ),
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}

export function ChatBox({ sessionId }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your **LogLens AI Copilot** powered by Gemma. Ask me any question about anomalies, service dependencies, error spikes, or cascading root causes across your uploaded logs.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

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
          content:
            "**Analysis Notice:** Encountered an issue connecting to the Gemma backend service. Please check your backend logs and verify your connection.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm flex flex-col h-[620px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              Gemma LogCopilot Chat
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            </h3>
            <p className="text-[11px] text-slate-400">
              Interactive natural language investigation grounded in unified log telemetry.
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
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 text-xs custom-scrollbar"
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {m.role === "assistant" && (
              <div className="h-7 w-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 shadow-sm mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`relative max-w-[88%] rounded-xl p-4 shadow-sm ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-slate-950/90 text-slate-200 border border-slate-800 rounded-bl-none shadow-md"
              }`}
            >
              {/* Copy button on assistant messages */}
              {m.role === "assistant" && (
                <button
                  onClick={() => copyToClipboard(m.content, idx)}
                  title="Copy response"
                  className="absolute top-2.5 right-2.5 rounded p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition-colors"
                >
                  {copiedIdx === idx ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              {/* Message Body */}
              {m.role === "assistant" ? (
                <AssistantMarkdown content={m.content} />
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              )}

              {/* Cited Services Badges */}
              {m.referenced_services && m.referenced_services.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Cited Services:
                  </span>
                  {m.referenced_services.map((svc) => (
                    <span
                      key={svc}
                      className="rounded bg-indigo-950/80 px-2 py-0.5 text-[10px] font-mono font-medium text-indigo-300 border border-indigo-500/30"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {m.role === "user" && (
              <div className="h-7 w-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-indigo-400 text-xs py-2 px-1">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span className="font-medium animate-pulse">
              Gemma is analyzing log patterns and causality...
            </span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mt-3 flex gap-2 pt-2.5 border-t border-slate-800/80"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the logs or incident..."
          disabled={isLoading}
          className="flex-1 rounded-lg bg-slate-800/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 border border-slate-700/80 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-indigo-600 px-3.5 py-2 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
