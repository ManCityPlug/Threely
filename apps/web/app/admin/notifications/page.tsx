"use client";

import { useEffect, useState } from "react";

interface Notification {
  id: string;
  heading: string;
  subheading: string;
  linkUrl: string | null;
  targetUserIds: string[];
  targetEmails: string[];
  createdAt: string;
  _count: { dismissals: number };
}

const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: "1.25rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  background: "#1e1e1e",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  color: "#e4e4e7",
  fontSize: "0.85rem",
  outline: "none",
  boxSizing: "border-box" as const,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#a1a1aa",
  marginBottom: 4,
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [heading, setHeading] = useState("");
  const [subheading, setSubheading] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [targetEmails, setTargetEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Force update state
  const [currentVersion, setCurrentVersion] = useState("1.0.0");
  const [newVersion, setNewVersion] = useState("");
  const [versionSaving, setVersionSaving] = useState(false);
  const [versionMsg, setVersionMsg] = useState("");

  useEffect(() => {
    loadNotifications();
    loadVersion();
  }, []);

  async function loadNotifications() {
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch {}
  }

  async function loadVersion() {
    try {
      const res = await fetch("/api/admin/update-alert");
      if (res.ok) {
        const data = await res.json();
        setCurrentVersion(data.minAppVersion);
      }
    } catch {}
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!heading.trim() || !subheading.trim()) return;

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const emails = targetEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heading: heading.trim(),
          subheading: subheading.trim(),
          linkUrl: linkUrl.trim() || null,
          targetEmails: emails.length > 0 ? emails : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }

      setHeading("");
      setSubheading("");
      setLinkUrl("");
      setTargetEmails("");
      setSuccess("Notification sent!");
      setTimeout(() => setSuccess(""), 3000);
      loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notification?")) return;
    try {
      await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
      loadNotifications();
    } catch {}
  }

  async function handleSetVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!newVersion.trim()) return;

    setVersionSaving(true);
    setVersionMsg("");

    try {
      const res = await fetch("/api/admin/update-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: newVersion.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set version");
      }

      const data = await res.json();
      setCurrentVersion(data.minAppVersion);
      setNewVersion("");
      setVersionMsg("Version updated!");
      setTimeout(() => setVersionMsg(""), 3000);
    } catch (err) {
      setVersionMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setVersionSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#fff",
          marginBottom: "0.25rem",
        }}
      >
        Notifications
      </h1>
      <p
        style={{
          fontSize: "0.85rem",
          color: "#71717a",
          marginBottom: "2rem",
        }}
      >
        Send in-app notifications to all users or specific people
      </p>

      {/* ── Send Notification Form ──────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: "2rem" }}>
        <h2
          style={{
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "#fff",
            marginBottom: "1rem",
          }}
        >
          New Notification
        </h2>

        <form onSubmit={handleSend}>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={labelStyle}>Heading *</label>
            <input
              style={inputStyle}
              placeholder="e.g. New Feature Available!"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={labelStyle}>Subheading *</label>
            <input
              style={inputStyle}
              placeholder="e.g. Check out the new weekly insights dashboard."
              value={subheading}
              onChange={(e) => setSubheading(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={labelStyle}>Link URL (optional)</label>
            <input
              style={inputStyle}
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <div
              style={{ fontSize: "0.7rem", color: "#71717a", marginTop: 4 }}
            >
              If provided, an &quot;Open Link&quot; button will appear on the
              notification
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Target Emails (optional)</label>
            <input
              style={inputStyle}
              placeholder="user@example.com, another@example.com"
              value={targetEmails}
              onChange={(e) => setTargetEmails(e.target.value)}
            />
            <div
              style={{ fontSize: "0.7rem", color: "#71717a", marginTop: 4 }}
            >
              Comma-separated. Leave blank to send to all users.
            </div>
          </div>

          {error && (
            <div
              style={{
                color: "#fca5a5",
                fontSize: "0.85rem",
                marginBottom: "0.75rem",
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                color: "#86efac",
                fontSize: "0.85rem",
                marginBottom: "0.75rem",
              }}
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !heading.trim() || !subheading.trim()}
            style={{
              padding: "0.6rem 1.5rem",
              background: sending ? "#3f3f46" : "#D4A843",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: sending ? "wait" : "pointer",
            }}
          >
            {sending ? "Sending..." : "Send Notification"}
          </button>
        </form>
      </div>

      {/* ── Sent Notifications ──────────────────────────────────── */}
      <h2
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Sent Notifications ({notifications.length})
      </h2>

      {notifications.length === 0 ? (
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            color: "#71717a",
            padding: "2rem",
            marginBottom: "2rem",
          }}
        >
          No notifications sent yet
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "2rem",
          }}
        >
          {notifications.map((n) => (
            <div key={n.id} style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#e4e4e7",
                      fontSize: "0.9rem",
                      marginBottom: 2,
                    }}
                  >
                    {n.heading}
                  </div>
                  <div
                    style={{
                      color: "#a1a1aa",
                      fontSize: "0.8rem",
                      marginBottom: 4,
                    }}
                  >
                    {n.subheading}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "center",
                      fontSize: "0.7rem",
                      color: "#71717a",
                    }}
                  >
                    <span>
                      {new Date(n.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>{n._count.dismissals} dismissed</span>
                    <span>
                      {n.targetUserIds.length > 0
                        ? `To: ${n.targetEmails.join(", ")}`
                        : "To: Everyone"}
                    </span>
                    {n.linkUrl && (
                      <a
                        href={n.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#D4A843", textDecoration: "none" }}
                      >
                        {n.linkUrl}
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  style={{
                    background: "none",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    padding: "4px 10px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Force Update Section ────────────────────────────────── */}
      <h2
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Force App Update
      </h2>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#a1a1aa" }}>
            Current minimum version:
          </span>
          <span
            style={{
              background: "#1e1e1e",
              padding: "2px 10px",
              borderRadius: 6,
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#3ecf8e",
              fontFamily: "monospace",
            }}
          >
            {currentVersion}
          </span>
        </div>

        <div
          style={{
            fontSize: "0.75rem",
            color: "#71717a",
            marginBottom: "1rem",
            lineHeight: 1.5,
          }}
        >
          Users on an app version below this will see a blocking &quot;Update
          Required&quot; modal that cannot be dismissed. They must update the app
          to continue.
        </div>

        <form
          onSubmit={handleSetVersion}
          style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}
        >
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>New minimum version</label>
            <input
              style={inputStyle}
              placeholder="e.g. 1.1.0"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              pattern="\d+\.\d+\.\d+"
              required
            />
          </div>
          <button
            type="submit"
            disabled={versionSaving || !newVersion.trim()}
            style={{
              padding: "0.6rem 1.25rem",
              background: versionSaving ? "#3f3f46" : "#f59e0b",
              color: "#000",
              border: "none",
              borderRadius: 8,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: versionSaving ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {versionSaving ? "Saving..." : "Set Version"}
          </button>
        </form>

        {versionMsg && (
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.8rem",
              color: versionMsg.includes("Error") ? "#fca5a5" : "#86efac",
            }}
          >
            {versionMsg}
          </div>
        )}
      </div>
    </div>
  );
}
