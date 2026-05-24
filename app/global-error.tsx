"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <div className="text-center px-4">
          <p className="text-5xl mb-4">🚨</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Error</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            {error.message || "A critical error occurred. Please reload the page."}
          </p>
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors"
          >
            Try again
          </button>
          {error.digest && (
            <p className="text-xs text-gray-300 mt-6 font-mono">ref: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
