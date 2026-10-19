"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  getBrowserId,
  getDisplayName,
  saveDisplayName,
  getPublicNumber,
  getNameColor,
  saveNameColor,
  CHAT_COLORS,
} from "@/utils/supabase/identity";

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [browserId, setBrowserId] = useState("");
  const [publicNumber, setPublicNumber] = useState("");
  const [name, setName] = useState("");
  const [nameColor, setNameColor] = useState("#8000A6");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setBrowserId(getBrowserId());
    setPublicNumber(getPublicNumber());
    setName(getDisplayName());
    setNameColor(getNameColor());
  }, []);

  useEffect(() => {
    if (!isOpen || !joined || !browserId) return;

    let active = true;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, browser_id, public_number, display_name, name_color, message, created_at"
        )
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
          setError(
            "Live updates failed. Check your Supabase Realtime settings."
          );
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

    if (cleanName.length > 30) {
      setError("Names must be 30 characters or fewer.");
      return;
    }

    saveDisplayName(cleanName);
    saveNameColor(nameColor);
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
      public_number: publicNumber,
      display_name: name.trim(),
      name_color: nameColor,
      message: cleanMessage,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("");
    }

    setSending(false);
  }

  function getNumber(item) {
    if (item.public_number) return item.public_number;

    // Fallback for messages sent before numbers were saved.
    const digits = (item.browser_id || "").replace(/\D/g, "");
    return digits.slice(0, 4).padEnd(4, "0");
  }

  function getName(item) {
    return item.display_name?.trim() || "User";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        aria-expanded={isOpen}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border-2 border-black bg-orange-500 px-5 py-3 font-bold text-black shadow-xl transition hover:bg-orange-400"
      >
        <span aria-hidden="true">{isOpen ? "×" : "💬"}</span>
        {isOpen ? "Close chat" : "Earlify Chat"}
      </button>

      {isOpen && (
        <section
          aria-label="Earlify community chat"
          className="fixed bottom-20 right-4 z-50 flex h-[min(600px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border-2 border-black bg-orange-50 text-black shadow-2xl"
        >
          <header className="flex items-center justify-between border-b-2 border-black bg-orange-500 p-4">
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
                className="rounded border border-black px-2 py-1 text-sm hover:bg-orange-300"
              >
                Edit identity
              </button>
            )}
          </header>

          {!joined ? (
            <form
              onSubmit={joinChat}
              className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto p-5"
            >
              <p>Choose how you want to appear in the chat.</p>

              <label className="text-sm font-bold" htmlFor="chat-name">
                Display name (optional)
              </label>

              <input
                id="chat-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={`User #${publicNumber || "...."}`}
                maxLength={30}
                className="w-full rounded border-2 border-black bg-white p-3 outline-orange-600"
              />

              <div>
                <p className="mb-2 text-sm font-bold">Choose your name colour</p>

                <div className="grid grid-cols-6 gap-3">
                  {CHAT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      aria-label={`Choose colour ${color}`}
                      aria-pressed={nameColor === color}
                      onClick={() => {
                        setNameColor(color);
                        saveNameColor(color);
                      }}
                      className={`h-9 w-full rounded-full border-2 ${
                        nameColor === color
                          ? "border-black ring-2 ring-orange-500 ring-offset-2"
                          : "border-gray-300"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded border border-orange-200 bg-white p-3">
                <p className="text-xs text-gray-600">Preview</p>
                <strong style={{ color: nameColor }}>
                  {name.trim() || "User"} #{publicNumber || "...."}
                </strong>
              </div>

              <button
                type="submit"
                className="rounded border-2 border-black bg-orange-500 p-3 font-bold hover:bg-orange-400"
              >
                Join chat
              </button>

              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
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

                {messages.map((item) => {
                  const number = getNumber(item);
                  const isYou = item.browser_id === browserId;

                  return (
                    <article
                      key={item.id}
                      className="break-words rounded-lg border border-orange-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <strong
                          className="text-sm"
                          style={{
                            color: CHAT_COLORS.includes(item.name_color)
                              ? item.name_color
                              : "#8000A6",
                          }}
                        >
                          {getName(item)} #{number}
                          {isYou && " (you)"}
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
                  );
                })}

                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="flex gap-2 border-t-2 border-black bg-orange-100 p-3"
              >
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write a message..."
                  maxLength={500}
                  required
                  className="min-w-0 flex-1 rounded border-2 border-black bg-white p-2 outline-orange-600"
                />

                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="rounded border-2 border-black bg-orange-500 px-3 font-bold hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
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