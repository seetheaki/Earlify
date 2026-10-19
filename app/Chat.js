
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  getBrowserId,
  getDisplayName,
  saveDisplayName,
} from "@/utils/supabase/identity";

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [browserId, setBrowserId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setBrowserId(getBrowserId());
    setName(getDisplayName());
  }, []);

  useEffect(() => {
    if (!isOpen || !joined || !browserId) return;

    let active = true;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id, browser_id, display_name, message, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (error) {
        setError(error.message);
        return;
      }

      setMessages((current) => {
        const combined = [...(data ?? []).reverse(), ...current];
        return Array.from(
          new Map(combined.map((item) => [item.id, item])).values()
        ).slice(-100);
      });
    }

    loadMessages();

    const channel = supabase
      .channel("earlify-public-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          setMessages((current) => {
            if (current.some((item) => item.id === payload.new.id)) {
              return current;
            }
            return [...current, payload.new].slice(-100);
          });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" && active) {
          setError("Live updates failed. Check your Supabase Realtime settings.");
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, joined, browserId]);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  function joinChat(event) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName || cleanName.length > 30) {
      setError("Choose a name between 1 and 30 characters.");
      return;
    }

    saveDisplayName(cleanName);
    setName(cleanName);
    setError("");
    setJoined(true);
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanMessage = message.trim();

    if (!cleanMessage || sending) return;

    if (cleanMessage.length > 500) {
      setError("Messages must be 500 characters or fewer.");
      return;
    }

    setSending(true);
    setError("");

    const { error } = await supabase.from("messages").insert({
      browser_id: browserId,
      display_name: name,
      message: cleanMessage,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("");
    }

    setSending(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        aria-expanded={isOpen}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2
          rounded-full border-2 border-black bg-orange-500 px-5 py-3
          font-bold text-black shadow-xl transition hover:bg-orange-400"
      >
        <span aria-hidden="true">{isOpen ? "×" : "💬"}</span>
        {isOpen ? "Close chat" : "Earlify Chat"}
      </button>

      {isOpen && (
        <section
          aria-label="Earlify community chat"
          className="fixed bottom-20 right-4 z-50 flex h-[min(600px,75vh)]
            w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden
            rounded-xl border-2 border-black bg-orange-50 text-black shadow-2xl"
        >
          <header className="flex items-center justify-between border-b-2
            border-black bg-orange-500 p-4">
            <div>
              <h2 className="text-xl font-bold">Earlify Chat</h2>
              <p className="text-sm">The community hangout</p>
            </div>

            {joined && (
              <button
                type="button"
                onClick={() => {
                  setJoined(false);
                  setError("");
                }}
                className="rounded border border-black px-2 py-1 text-sm
                  hover:bg-orange-300"
              >
                Change name
              </button>
            )}
          </header>

          {!joined ? (
            <form
              onSubmit={joinChat}
              className="flex flex-1 flex-col justify-center gap-4 p-5"
            >
              <p>Choose a name and join the conversation.</p>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your display name"
                maxLength={30}
                required
                className="w-full rounded border-2 border-black bg-white
                  p-3 outline-orange-600"
              />

              <button
                type="submit"
                className="rounded border-2 border-black bg-orange-500
                  p-3 font-bold hover:bg-orange-400"
              >
                Join chat
              </button>

              {error && (
                <p role="alert" className="text-sm text-red-700">{error}</p>
              )}
            </form>
          ) : (
            <>
              <div
                aria-live="polite"
                className="flex-1 space-y-3 overflow-y-auto p-4"
              >
                {messages.length === 0 && (
                  <p className="text-sm text-gray-600">
                    No messages yet. Start the conversation!
                  </p>
                )}

                {messages.map((item) => (
                  <article
                    key={item.id}
                    className="break-words rounded-lg border border-orange-200
                      bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="text-sm">
                        {item.display_name}
                        {item.browser_id === browserId && " (you)"}
                      </strong>
                      <time className="shrink-0 text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>

                    <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                  </article>
                ))}

                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="flex gap-2 border-t-2 border-black
                  bg-orange-100 p-3"
              >
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write a message..."
                  maxLength={500}
                  required
                  className="min-w-0 flex-1 rounded border-2 border-black
                    bg-white p-2 outline-orange-600"
                />

                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="rounded border-2 border-black bg-orange-500
                    px-3 font-bold hover:bg-orange-400
                    disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? "..." : "Send"}
                </button>
              </form>

              {error && (
                <p role="alert" className="bg-white px-3 pb-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
