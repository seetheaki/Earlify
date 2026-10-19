
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
  let [isOpen, setIsOpen] = useState(false);
  let [browserId, setBrowserId] = useState("");
  let [publicNumber, setPublicNumber] = useState("");
  let [name, setName] = useState("");
  let [nameColor, setNameColor] = useState("#8000A6");
  let [joined, setJoined] = useState(false);
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [error, setError] = useState("");
  let [sending, setSending] = useState(false);

  let bottomRef = useRef(null);

  // Load the saved identity when the chat first opens in the app.
  useEffect(function initialiseIdentity() {
    setBrowserId(getBrowserId());
    setPublicNumber(getPublicNumber());
    setName(getDisplayName());
    setNameColor(getNameColor());
  }, []);

  // Load messages and listen for new messages from Supabase.
  useEffect(function manageChatMessages() {
    if (!isOpen || !joined || !browserId) {
      return;
    }

    let active = true;

    async function loadMessages() {
      let result = await supabase
        .from("messages")
        .select(
          "id, browser_id, public_number, display_name, name_color, message, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) {
        return;
      }

      if (result.error) {
        setError(result.error.message);
        return;
      }

      let loadedMessages = [];

      if (result.data) {
        loadedMessages = result.data.reverse();
      }

      setMessages(function mergeLoadedMessages(current) {
        let combined = [...loadedMessages, ...current];

        let uniqueMessages = new Map();

        for (let i = 0; i < combined.length; i++) {
          uniqueMessages.set(combined[i].id, combined[i]);
        }

        return Array.from(uniqueMessages.values()).slice(-100);
      });
    }

    function handleNewMessage(payload) {
      setMessages(function addNewMessage(current) {
        let alreadyExists = current.some(
          function checkExistingMessage(item) {
            return item.id === payload.new.id;
          }
        );

        if (alreadyExists) {
          return current;
        }

        return [...current, payload.new].slice(-100);
      });
    }

    function handleSubscriptionStatus(status) {
      if (status === "CHANNEL_ERROR" && active) {
        setError(
          "Live updates failed. Check your Supabase Realtime settings."
        );
      }
    }

    loadMessages();

    let channel = supabase
      .channel("earlify-public-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        handleNewMessage
      )
      .subscribe(handleSubscriptionStatus);

    // Stop listening when this effect needs to be cleaned up.
    return function cleanupChatMessages() {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, joined, browserId]);

  // Scroll down when messages change and the chat is open.
  useEffect(function scrollToLatestMessage() {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Open or close the chat panel.
  function toggleChat() {
    setIsOpen(function togglePreviousOpenState(open) {
      return !open;
    });
  }

  // Return the correct label for the chat button.
  function getChatButtonLabel() {
    if (isOpen) {
      return "Close chat";
    }

    return "Earlify Chat";
  }

  function getChatButtonIcon() {
    if (isOpen) {
      return "×";
    }

    return "💬";
  }

  // Save the chosen identity and join the chat.
  function joinChat(event) {
    event.preventDefault();

    let cleanName = name.trim();

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

  // Send a message to the Supabase database.
  async function sendMessage(event) {
    event.preventDefault();

    let cleanMessage = message.trim();

    if (!cleanMessage || sending) {
      return;
    }

    if (cleanMessage.length > 500) {
      setError("Messages must be 500 characters or fewer.");
      return;
    }

    setSending(true);
    setError("");

    try {
      let result = await supabase.from("messages").insert({
        browser_id: browserId,
        public_number: publicNumber,
        display_name: name.trim(),
        name_color: nameColor,
        message: cleanMessage,
      });

      if (result.error) {
        setError(result.error.message);
      } else {
        setMessage("");
      }
    } catch (sendError) {
      setError("Unable to send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // Get the four-digit number attached to a user's messages.
  function getNumber(item) {
    if (item.public_number) {
      return item.public_number;
    }

    // Fallback for messages sent before numbers were saved.
    let digits = (item.browser_id || "").replace(/\D/g, "");

    return digits.slice(0, 4).padEnd(4, "0");
  }

  // Use a fallback name if a message has no display name.
  function getName(item) {
    if (item.display_name && item.display_name.trim()) {
      return item.display_name.trim();
    }

    return "User";
  }

  // Choose a valid colour for a message author's name.
  function getItemColor(item) {
    if (CHAT_COLORS.includes(item.name_color)) {
      return item.name_color;
    }

    return "#8000A6";
  }

  // Change the selected name colour.
  function createColorClickHandler(color) {
    function handleColorClick() {
      setNameColor(color);
      saveNameColor(color);
    }

    return handleColorClick;
  }

  // Display one colour selection button.
  function renderColorButton(color) {
    let selectedClass = "border-gray-300";

    if (nameColor === color) {
      selectedClass =
        "border-black ring-2 ring-orange-500 ring-offset-2";
    }

    return (
      <button
        key={color}
        type="button"
        title={color}
        aria-label={"Choose colour " + color}
        aria-pressed={nameColor === color}
        onClick={createColorClickHandler(color)}
        className={"h-9 w-full rounded-full border-2 " + selectedClass}
        style={{ backgroundColor: color }}
      />
    );
  }

  // Display one message in the chat.
  function renderMessage(item) {
    let number = getNumber(item);
    let isYou = item.browser_id === browserId;
    let displayName = getName(item);

    if (isYou) {
      displayName = displayName + " (you)";
    }

    let time = new Date(item.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <article
        key={item.id}
        className="break-words rounded-lg border border-orange-200 bg-white p-3 shadow-sm"
      >
        <div className="flex items-baseline justify-between gap-2">
          <strong
            className="text-sm"
            style={{ color: getItemColor(item) }}
          >
            {getName(item)} #{number}
            {isYou && " (you)"}
          </strong>

          <time className="shrink-0 text-xs text-gray-500">
            {time}
          </time>
        </div>

        <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
      </article>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleChat}
        aria-label={getChatButtonLabel()}
        aria-expanded={isOpen}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border-2 border-black bg-orange-500 px-5 py-3 font-bold text-black shadow-xl transition hover:bg-orange-400"
      >
        <span aria-hidden="true">{getChatButtonIcon()}</span>
        {getChatButtonLabel()}
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
                onClick={function editIdentity() {
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
                onChange={function updateName(event) {
                  setName(event.target.value);
                }}
                placeholder={"User #" + (publicNumber || "....")}
                maxLength={30}
                className="w-full rounded border-2 border-black bg-white p-3 outline-orange-600"
              />

              <div>
                <p className="mb-2 text-sm font-bold">
                  Choose your name colour
                </p>

                <div className="grid grid-cols-6 gap-3">
                  {CHAT_COLORS.map(renderColorButton)}
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

                {messages.map(renderMessage)}

                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="flex gap-2 border-t-2 border-black bg-orange-100 p-3"
              >
                <input
                  value={message}
                  onChange={function updateMessage(event) {
                    setMessage(event.target.value);
                  }}
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
                <p
                  role="alert"
                  className="bg-white px-3 pb-2 text-sm text-red-700"
                >
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
