// Student avatar — gold disc with the first initial (DESIGN.md §7a header).

export function StudentAvatar({
  name,
  size = 34,
  bg = "#F2B23E",
}: {
  name: string;
  size?: number;
  bg?: string;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
