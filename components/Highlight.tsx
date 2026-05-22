import { splitHighlight } from "@/lib/utils";

interface Props {
  text: string | null | undefined;
  query: string;
  className?: string;
}

export default function Highlight({ text, query, className }: Props) {
  if (!text) return null;
  const parts = splitHighlight(text, query);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.match ? (
          <mark
            key={i}
            className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic font-semibold"
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}
