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
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [suggestions, setSuggestions] = useState<UserResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchUsers = useCallback(async (p: number, q?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q && q.length >= 2) params.set("q", q);
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
    setPage(data.page || 1);
    setLoading(false);
  }, []);

  // Load all users on mount
  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  // Search suggestions as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          setSuggestions(data.users || []);
          setShowDropdown((data.users || []).length > 0);
          setHighlightIdx(-1);
        });
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

  const doSearch = () => {
    setShowDropdown(false);
    setPage(1);
    fetchUsers(1, query);
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    fetchUsers(1);
  };

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
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: 0 }}>
          Users
        </h1>
        <span style={{ fontSize: "0.85rem", color: "#52525b" }}>
          {total} total
        </span>
      </div>
      <p style={{ fontSize: "0.85rem", color: "#71717a", marginBottom: "1.5rem" }}>
        All registered users &middot; 30 per page
      </p>

      {/* Search input with dropdown */}
      <div ref={wrapperRef} style={{ position: "relative", maxWidth: 400, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Search by email..."
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
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
          {query && (
            <button
              onClick={clearSearch}
              style={{
                padding: "0.6rem 0.75rem",
                background: "#27272a",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                color: "#a1a1aa",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: query ? "auto" : 0,
              width: query ? "calc(100% - 68px)" : "100%",
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
                onClick={() => { setShowDropdown(false); router.push(`/admin/users/${u.id}`); }}
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
                      background: u.subscriptionStatus === "active" ? "#052e16" : u.subscriptionStatus === "trialing" ? "#1e1b4b" : "#27272a",
                      color: u.subscriptionStatus === "active" ? "#4ade80" : u.subscriptionStatus === "trialing" ? "#a78bfa" : "#71717a",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {u.subscriptionStatus}
                  </span>
                )}
              </button>
            ))}
            <div style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", color: "#52525b", borderTop: "1px solid #27272a" }}>
              Press Enter to search &middot; &uarr;&darr; to navigate
            </div>
          </div>
        )}
      </div>

      {/* Users table */}
      {loading ? (
        <div style={{ color: "#71717a", fontSize: "0.85rem" }}>Loading...</div>
      ) : users.length === 0 ? (
        <div style={{ color: "#71717a", fontSize: "0.85rem" }}>No users found</div>
      ) : (
        <>
          <div
            style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #27272a" }}>
                  {["Email", "Goals", "Tasks", "Subscription", "Joined", ""].map((h) => (
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
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    style={{ borderBottom: "1px solid #1e1e21", cursor: "pointer" }}
                  >
                    <td style={{ padding: "0.65rem 1rem", color: "#e4e4e7" }}>{u.email}</td>
                    <td style={{ padding: "0.65rem 1rem", color: "#a1a1aa" }}>{u.goalCount}</td>
                    <td style={{ padding: "0.65rem 1rem", color: "#a1a1aa" }}>{u.taskCount}</td>
                    <td style={{ padding: "0.65rem 1rem" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: u.subscriptionStatus === "active" ? "#052e16" : u.subscriptionStatus === "trialing" ? "#1e1b4b" : "#27272a",
                          color: u.subscriptionStatus === "active" ? "#4ade80" : u.subscriptionStatus === "trialing" ? "#a78bfa" : "#71717a",
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
                        onClick={(e) => { e.stopPropagation(); router.push(`/admin/users/${u.id}`); }}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem" }}>
              <span style={{ fontSize: "0.8rem", color: "#52525b" }}>
                Page {page} of {totalPages}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => fetchUsers(page - 1, query.length >= 2 ? query : undefined)}
                  style={{
                    padding: "6px 14px",
                    background: page <= 1 ? "#18181b" : "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                    color: page <= 1 ? "#3f3f46" : "#e4e4e7",
                    fontSize: "0.8rem",
                    cursor: page <= 1 ? "default" : "pointer",
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchUsers(page + 1, query.length >= 2 ? query : undefined)}
                  style={{
                    padding: "6px 14px",
                    background: page >= totalPages ? "#18181b" : "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                    color: page >= totalPages ? "#3f3f46" : "#e4e4e7",
                    fontSize: "0.8rem",
                    cursor: page >= totalPages ? "default" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
