"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UserResult {
  id: string;
  email: string;
  createdAt: string;
  subscriptionStatus: string | null;
  goalCount: number;
  taskCount: number;
  profile: { dailyTimeMinutes: number; intensityLevel: number } | null;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserResult[]>([]);
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          const users = data.users || [];
          setSuggestions(users);
          setShowDropdown(users.length > 0);
          setHighlightIdx(-1);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 300);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(() => {
    setShowDropdown(false);
    setResults(suggestions);
  }, [suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === "Enter") doSearch();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        router.push(`/admin/users/${suggestions[highlightIdx].id}`);
      } else {
        doSearch();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const selectUser = (user: UserResult) => {
    setShowDropdown(false);
    router.push(`/admin/users/${user.id}`);
  };

  // Highlight matching portion of email
  const highlightMatch = (email: string) => {
    const idx = email.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{email}</span>;
    return (
      <>
        <span style={{ color: "#71717a" }}>{email.slice(0, idx)}</span>
        <span style={{ color: "#fff", fontWeight: 600 }}>{email.slice(idx, idx + query.length)}</span>
        <span style={{ color: "#71717a" }}>{email.slice(idx + query.length)}</span>
      </>
    );
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#fff",
          marginBottom: "0.25rem",
        }}
      >
        Users
      </h1>
      <p
        style={{
          fontSize: "0.85rem",
          color: "#71717a",
          marginBottom: "1.5rem",
        }}
      >
        Search by email address
      </p>

      {/* Search input with dropdown */}
      <div ref={wrapperRef} style={{ position: "relative", maxWidth: 400, marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Search by email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            padding: "0.6rem 0.75rem",
            background: "#18181b",
            border: showDropdown ? "1px solid #3f3f46" : "1px solid #27272a",
            borderRadius: showDropdown ? "8px 8px 0 0" : 8,
            color: "#fff",
            fontSize: "0.9rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Autocomplete dropdown */}
        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderTop: "none",
              borderRadius: "0 0 8px 8px",
              zIndex: 50,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {suggestions.map((u, i) => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                onMouseEnter={() => setHighlightIdx(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  background: i === highlightIdx ? "#27272a" : "transparent",
                  border: "none",
                  borderBottom: i < suggestions.length - 1 ? "1px solid #1e1e21" : "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                }}
              >
                <span>{highlightMatch(u.email)}</span>
                {u.subscriptionStatus && (
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      background:
                        u.subscriptionStatus === "active"
                          ? "#052e16"
                          : u.subscriptionStatus === "trialing"
                            ? "#1e1b4b"
                            : "#27272a",
                      color:
                        u.subscriptionStatus === "active"
                          ? "#4ade80"
                          : u.subscriptionStatus === "trialing"
                            ? "#a78bfa"
                            : "#71717a",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {u.subscriptionStatus}
                  </span>
                )}
              </button>
            ))}
            <div
              style={{
                padding: "0.4rem 0.75rem",
                fontSize: "0.75rem",
                color: "#52525b",
                borderTop: "1px solid #27272a",
              }}
            >
              Press Enter to search &middot; &uarr;&darr; to navigate
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ color: "#71717a", fontSize: "0.85rem" }}>
          Searching...
        </div>
      )}

      {/* Full results table (shown after Enter) */}
      {!loading && results.length > 0 && (
        <div
          style={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                {["Email", "Goals", "Tasks", "Subscription", "Joined", ""].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "0.75rem 1rem",
                        color: "#71717a",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {results.map((u) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: "1px solid #1e1e21" }}
                >
                  <td style={{ padding: "0.65rem 1rem", color: "#e4e4e7" }}>
                    {u.email}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", color: "#a1a1aa" }}>
                    {u.goalCount}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", color: "#a1a1aa" }}>
                    {u.taskCount}
                  </td>
                  <td style={{ padding: "0.65rem 1rem" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background:
                          u.subscriptionStatus === "active"
                            ? "#052e16"
                            : u.subscriptionStatus === "trialing"
                              ? "#1e1b4b"
                              : "#27272a",
                        color:
                          u.subscriptionStatus === "active"
                            ? "#4ade80"
                            : u.subscriptionStatus === "trialing"
                              ? "#a78bfa"
                              : "#71717a",
                      }}
                    >
                      {u.subscriptionStatus || "none"}
                    </span>
                  </td>
                  <td style={{ padding: "0.65rem 1rem", color: "#71717a" }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.65rem 1rem" }}>
                    <button
                      onClick={() => router.push(`/admin/users/${u.id}`)}
                      style={{
                        padding: "4px 12px",
                        background: "#27272a",
                        border: "1px solid #3f3f46",
                        borderRadius: 6,
                        color: "#e4e4e7",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && suggestions.length === 0 && (
        <div style={{ color: "#71717a", fontSize: "0.85rem" }}>
          No users found
        </div>
      )}
    </div>
  );
}
