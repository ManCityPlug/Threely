"use client";

export type ToastType = "success" | "error" | "info";

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

const ICON: Record<ToastType, string> = {
  success: "\u2713",
  error: "\u2717",
  info: "\u2139",
};

export default function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className={`toast toast-${toast.type}${toast.exiting ? " toast-exit" : ""}`}
      role="alert"
    >
      <span className="toast-icon">{ICON[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
      >
        {"\u2715"}
      </button>
    </div>
  );
}
