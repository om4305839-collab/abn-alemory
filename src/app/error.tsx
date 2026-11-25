"use client";

// Generic error boundary: never renders error.message / stack to visitors.
export default function GlobalRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-md p-10 text-center">
        <div className="mb-4 text-6xl" aria-hidden="true">⚠️</div>
        <h1 className="mb-2 text-2xl font-extrabold text-brown">حدث خطأ غير متوقع</h1>
        <p className="mb-6 text-mocha">نعتذر عن ذلك. يرجى المحاولة مرة أخرى.</p>
        <button onClick={reset} className="btn btn-primary">إعادة المحاولة</button>
      </div>
    </div>
  );
}
