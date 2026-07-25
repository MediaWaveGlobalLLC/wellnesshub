"use client";

/*
  Vapor ascendiendo — tres hebras onduladas que suben y se desvanecen.
  Hereda el color del padre (currentColor). Decorativo.
*/
export function Steam({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 60"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 58 C 4 48, 14 42, 9 32 C 4 22, 14 16, 9 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="steam-path"
        style={{ animationDelay: "0s" }}
      />
      <path
        d="M20 58 C 15 48, 25 42, 20 32 C 15 22, 25 16, 20 4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="steam-path"
        style={{ animationDelay: "1.1s" }}
      />
      <path
        d="M31 58 C 26 48, 36 42, 31 32 C 26 22, 36 16, 31 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="steam-path"
        style={{ animationDelay: "2.2s" }}
      />
    </svg>
  );
}
