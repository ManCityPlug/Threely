// ─── AppTutorial (disabled) ──────────────────────────────────────────────────
// The in-app tutorial has been removed. This stub exists only to satisfy
// existing imports until they are cleaned up. It always renders nothing.

interface AppTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AppTutorial(_props: AppTutorialProps) {
  return null;
}
