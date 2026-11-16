// Decorative ✕ icon; the button that wraps it carries the accessible name.
export function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
