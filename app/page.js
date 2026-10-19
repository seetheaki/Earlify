"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import Chat from "./Chat";
export default function Home() {
  var [search, setSearch] = useState("");
  var [results, setResults] = useState([]);
  useEffect(() => {
    async function searchEvents() {
      var term = search.trim();
      if (!term) {
        setResults([]);
        return;
      }
      var { data } = await supabase
        .from("Events")
        .select("*")
        .or(
          `title.ilike.%${term}%,description.ilike.%${term}%,sport.ilike.%${term}%,location.ilike.%${term}%,image_url.ilike.%${term}%`
        );
      setResults(data);
    }
    searchEvents();
  }, [search]);
  return (
    <main className="bg-orange-500 min-h-screen">
      <h1 className="text-8xl font-bold bg-orange-500">Event Search</h1>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search Events..."
        className="border-1 bg-gradient-to-r from-black to-orange-500"
      />
      <div className="bg-blue-500 border-solid border-4 border-black">
        {results.map((event) => (
          <div key={event.id}>
            <h2>{event.title}</h2>
            <p>{event.description}</p>
            <p>{event.sport}</p>
            <p>{event.location}</p>
          </div>
        ))}
      </div>
      <Chat />
    </main>
  );
}