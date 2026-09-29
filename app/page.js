"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
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
          `title.ilike.%${term}%,description.ilike.%${term}%,sport.ilike.%${term}%,location.ilike.%${term}%`
        );
      setResults(data);
    }
    searchEvents();
  }, [search]);
  return (
    <main>
      <h1>Event Search</h1>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search Events..."
      />
      <div>
        {results.map((event) => (
          <div key={event.id}>
            <h2>{event.title}</h2>
            <p>{event.description}</p>
            <p>{event.sport}</p>
            <p>{event.location}</p>
          </div>
        ))}
      </div>
    </main>
  );
}