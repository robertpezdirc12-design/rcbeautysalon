import Link from "next/link"

// #91 — segmenti = oznake: vrsta chipov nad tabelo Strank. Klik na
// oznako filtrira OBE tabeli (registrirane + linke) strežniško.
export function TagFilterBar({
  tags,
  activeTag,
  search,
  allLabel,
  label,
}: {
  tags: string[]
  activeTag: string | null
  search?: string
  allLabel: string
  label: string
}) {
  if (tags.length === 0) return null

  function href(tag: string | null) {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (tag) params.set("tag", tag)
    const qs = params.toString()
    return `/dashboard/users${qs ? `?${qs}` : ""}`
  }

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      <Link
        href={href(null)}
        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
          !activeTag
            ? "border-primary bg-primary/5 font-medium ring-2 ring-primary/30"
            : "hover:border-primary/40"
        }`}
      >
        {allLabel}
      </Link>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={href(tag)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            activeTag === tag
              ? "border-primary bg-primary/5 font-medium ring-2 ring-primary/30"
              : "hover:border-primary/40"
          }`}
        >
          {tag}
        </Link>
      ))}
    </nav>
  )
}
