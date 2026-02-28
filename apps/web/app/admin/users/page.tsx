"use client";

import { useState, useEffect, useRef } from "react";
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
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setUsers([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          setUsers(data.users || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 300);
  }, [query]);

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

      <input
        type="text"
        placeholder="Search by email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "0.6rem 0.75rem",
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: 8,
          color: "#fff",
          fontSize: "0.9rem",
          marginBottom: "1.5rem",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      {loading && (
        <div style={{ color: "#71717a", fontSize: "0.85rem" }}>
          Searching...
        </div>
      )}

      {!loading && users.length > 0 && (
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
              {users.map((u) => (
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

      {!loading && query.length >= 2 && users.length === 0 && (
        <div style={{ color: "#71717a", fontSize: "0.85rem" }}>
          No users found
        </div>
      )}
    </div>
  );
}
