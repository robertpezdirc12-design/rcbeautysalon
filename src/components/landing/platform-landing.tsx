import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Languages,
  PencilLine,
  ShoppingBag,
  Sparkles,
} from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { PLANS } from "@/lib/plans/registry"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"

// ============================================================
// P1 #66 / F1 — PLATFORM LANDING (the product's front door).
//
// "/"  → Slovenian, "/en" → English. Both are SERVER components: the
// language is part of the URL, not a cookie or a client-side switch,
// so crawlers and no-JS visitors get the right copy and metadata.
//
// Owner positioning (commit 15aa272) is kept VERBATIM in dict/landing.ts
// (hero.h1Lead / h1Accent / tagline / lead and the three "Kako deluje"
// steps). F1 adds: product visual, 5 real preset-image examples, FAQ,
// registry-driven plans with an honest pricing note, legal footer and a
// crawlable endonym language switcher. ONE primary CTA above the fold.
//
// The activity cards are a SAMPLE of 5 of the 12 registered profiles —
// the universal "generic" preset stays available in StartWizard but is
// deliberately not shown as a marketing example (owner decision 7. 11.).
// ============================================================

const MODULE_ICONS = [CalendarDays, ShoppingBag, PencilLine, Languages]

export function PlatformLanding({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing
  const plans = Object.values(PLANS)
  const isEn = locale === "en"
  const otherLangHref = isEn ? "/" : "/en"

  // Crawlable language links — endonyms, no IP/Accept-Language redirect,
  // and deliberately NOT writing the admin LOCALE_COOKIE.
  const langLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      hrefLang={href === "/en" ? "en" : "sl"}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs font-semibold"
          : "text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-xs font-medium"
      }
    >
      {label}
    </Link>
  )

  return (
    <div className="from-background via-background to-muted/40 min-h-screen bg-linear-to-b">
      {/* Platform-level structured data (tenant JSON-LD is injected by the
          root layout only when a published tenant brands the request). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "MARKEC",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: t.meta.description,
            inLanguage: ["sl", "en"],
          }),
        }}
      />
      <meta property="og:locale:alternate" content={isEn ? "sl_SI" : "en_US"} />
      {/* Header */}
      <header className="border-border/40 dark:bg-background/80 sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="container mx-auto flex items-center gap-4 px-4 py-3">
          <Link href="/" className="inline-flex shrink-0 items-center gap-2">
            <Logo variant="navbar" />
          </Link>
          <nav
            aria-label={t.aria.nav}
            className="text-muted-foreground ml-4 hidden items-center gap-5 text-sm lg:flex"
          >
            <Link href="#moduli" className="hover:text-foreground">
              {t.nav.modules}
            </Link>
            <Link href="#primeri" className="hover:text-foreground">
              {t.nav.examples}
            </Link>
            <Link href="#koraki" className="hover:text-foreground">
              {t.nav.steps}
            </Link>
            <Link href="#paketi" className="hover:text-foreground">
              {t.nav.plans}
            </Link>
          </nav>
          <span className="flex-1" />
          <div
            role="group"
            aria-label={t.aria.lang}
            className="border-border flex shrink-0 items-center gap-0.5 rounded-full border p-0.5"
          >
            {langLink("/", t.languages.sl, !isEn)}
            {langLink("/en", t.languages.en, isEn)}
          </div>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground hidden text-sm md:inline"
          >
            {t.nav.login}
          </Link>
          <Button
            asChild
            size="sm"
            className="min-h-11 shadow-md max-[420px]:hidden"
          >
            <Link href="/start">{t.nav.cta}</Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero — owner copy verbatim + immediate product visual. The
            second equal-weight CTA is now a quiet text link. */}
        <section className="container mx-auto grid items-center gap-12 px-4 py-12 md:py-16 lg:grid-cols-2">
          <div>
            <p className="text-primary-text border-border bg-background mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium">
              <Sparkles className="size-4" aria-hidden="true" />
              {t.hero.eyebrow}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {t.hero.h1Lead}{" "}
              <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                {t.hero.h1Accent}
              </span>
            </h1>
            <p className="text-muted-foreground mt-2 text-xs font-medium tracking-[0.2em] uppercase">
              {t.hero.tagline}
            </p>
            <p className="text-muted-foreground mt-4 max-w-xl text-base md:text-lg">
              {t.hero.lead}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-5">
              <Button asChild size="lg" className="min-h-12 shadow-lg">
                <Link href="/start">
                  {t.hero.cta}
                  <ArrowRight className="ml-2 size-5" aria-hidden="true" />
                </Link>
              </Button>
              <Link
                href="#primeri"
                className="text-primary-text border-b text-sm"
              >
                {t.hero.secondary}
              </Link>
            </div>
            <p className="text-muted-foreground mt-4 text-xs">{t.hero.micro}</p>
          </div>

          {/* Product visual — a CSS/HTML illustration of the guided setup.
              Own artwork, no stock/licensing risk, visible without animation. */}
          <div>
            <div
              role="img"
              aria-label={t.aria.mock}
              className="border-border bg-card overflow-hidden rounded-2xl border shadow-xl"
            >
              <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-3">
                <span className="bg-border size-2.5 rounded-full" />
                <span className="bg-border size-2.5 rounded-full" />
                <span className="bg-border size-2.5 rounded-full" />
                <span className="text-muted-foreground border-border bg-background ml-3 truncate rounded-md border px-3 py-1 text-xs">
                  {t.mock.url}
                </span>
              </div>
              <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr]">
                <div className="bg-muted/30 border-border text-muted-foreground space-y-1 border-r px-3 py-5 text-xs">
                  <p className="text-primary-text mb-3 text-[11px] font-bold tracking-wider">
                    {t.mock.brand}
                  </p>
                  {t.mock.side.map((label, i) => (
                    <span
                      key={label}
                      className={
                        i === 0
                          ? "bg-primary/10 text-primary-text block rounded-md px-2 py-1.5 font-semibold"
                          : "block rounded-md px-2 py-1.5"
                      }
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <div className="p-5">
                  <h2 className="text-sm font-semibold">{t.mock.title}</h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t.mock.progress}
                  </p>
                  <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${(t.mock.doneCount / t.mock.tasks.length) * 100}%`,
                      }}
                    />
                  </div>
                  <ul className="mt-3">
                    {t.mock.tasks.map((task, i) => (
                      <li
                        key={task}
                        className="border-border/60 text-muted-foreground flex items-center gap-2 border-b py-1.5 text-xs last:border-0"
                      >
                        <span
                          className={
                            i < t.mock.doneCount
                              ? "bg-primary text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-full text-[9px]"
                              : "border-border flex size-4 shrink-0 items-center justify-center rounded-full border"
                          }
                        >
                          {i < t.mock.doneCount ? (
                            <Check className="size-2.5" />
                          ) : null}
                        </span>
                        <span
                          className={
                            i < t.mock.doneCount
                              ? "text-foreground line-through"
                              : ""
                          }
                        >
                          {task}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-border mt-4 grid grid-cols-[88px_1fr] overflow-hidden rounded-xl border">
                    <Image
                      src="/img/presets/hero-barber.jpg"
                      alt={t.mock.miniAlt}
                      width={88}
                      height={76}
                      className="h-[76px] w-[88px] object-cover"
                    />
                    <div className="px-3 py-2 text-xs">
                      <strong className="block text-[13px]">
                        {t.mock.miniName}
                      </strong>
                      <span className="text-muted-foreground">
                        {t.mock.mini}
                      </span>
                      <br />
                      <span className="text-primary-text font-semibold">
                        {t.mock.miniCta}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-right text-xs">
              {t.mock.caption}
            </p>
          </div>
        </section>

        {/* Trust strip — verifiable facts only, no invented numbers/logos. */}
        <div className="border-border/40 bg-muted/30 border-y py-5">
          <ul className="container mx-auto grid grid-cols-1 gap-3 px-4 text-center text-sm sm:grid-cols-2 lg:grid-cols-4">
            {t.trust.map((item) => (
              <li
                key={item}
                className="text-muted-foreground flex items-center justify-center gap-2"
              >
                <span className="bg-primary/10 text-primary-text flex size-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Problem → modules */}
        <section id="moduli" className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
              {t.problem.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold">{t.problem.title}</h2>
            <p className="text-muted-foreground mt-4">{t.problem.lead}</p>
          </div>
          <ul className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
            {t.problem.cards.map((card) => (
              <li
                key={card.title}
                className="border-border/60 bg-card rounded-xl border p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {card.body}
                </p>
              </li>
            ))}
          </ul>
          <ul className="mx-auto mt-6 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.modules.map((mod, i) => {
              const Icon = MODULE_ICONS[i] ?? Sparkles
              return (
                <li
                  key={mod.title}
                  className="border-border/60 bg-card rounded-xl border p-5 shadow-sm"
                >
                  <span className="bg-primary/10 text-primary-text mb-4 flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">{mod.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {mod.body}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Examples — 5 of 12 registered profiles. 3 + 2 centered on desktop. */}
        <section
          id="primeri"
          className="border-border/40 bg-muted/30 border-y py-16"
        >
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
                {t.examples.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold">{t.examples.title}</h2>
              <p className="text-muted-foreground mt-4">{t.examples.lead}</p>
            </div>
            <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
              {t.examples.items.map((item, i) => (
                <li
                  key={item.vertical}
                  className={
                    i === 3
                      ? "lg:col-span-2 lg:col-start-2"
                      : i === 4
                        ? "lg:col-span-2 lg:col-start-4"
                        : "lg:col-span-2"
                  }
                >
                  <Link
                    href={`/start?vertical=${item.vertical}`}
                    className="border-border/60 bg-card hover:border-primary/40 hover:shadow-primary/10 flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <span className="text-primary-text text-[11px] font-semibold tracking-wider uppercase">
                        {t.examples.tag}
                      </span>
                      <h3 className="mt-2 text-lg font-semibold">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground mt-2 flex-1 text-sm">
                        {item.body}
                      </p>
                      <span className="text-primary-text mt-4 inline-flex items-center gap-1 text-sm font-medium">
                        {t.hero.secondary}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-center text-xs">
              {t.examples.more}
            </p>
          </div>
        </section>

        {/* How it works — owner's three-step flow (15aa272). */}
        <section id="koraki" className="container mx-auto px-4 py-16">
          <div className="text-center">
            <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
              {t.steps.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold">{t.steps.title}</h2>
          </div>
          <ol className="mx-auto mt-10 grid max-w-5xl gap-8 md:grid-cols-3">
            {t.steps.items.map((step, i) => (
              <li key={step.title} className="text-center">
                <div className="bg-primary/10 text-primary-text mx-auto mb-4 flex size-12 items-center justify-center rounded-full text-xl font-bold">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Plans — real limits/features from the registry, no invented prices. */}
        <section
          id="paketi"
          className="border-border/40 bg-muted/30 border-y py-16"
        >
          <div className="container mx-auto px-4">
            <div className="text-center">
              <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
                {t.plans.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold">{t.plans.title}</h2>
              <p className="text-muted-foreground mt-4">{t.plans.lead}</p>
            </div>
            <ul className="mx-auto mt-10 grid max-w-5xl items-stretch gap-5 md:grid-cols-3">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className={
                    plan.id === "pro"
                      ? "border-primary bg-card relative flex flex-col rounded-xl border-2 p-6 shadow-md"
                      : "border-border/60 bg-card flex flex-col rounded-xl border p-6 shadow-sm"
                  }
                >
                  {plan.id === "pro" && (
                    <span className="bg-primary text-primary-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-semibold">
                      {t.plans.badge}
                    </span>
                  )}
                  <h3 className="text-primary-text text-sm font-bold tracking-widest">
                    {plan.label}
                  </h3>
                  <p className="text-muted-foreground mt-2 min-h-11 text-sm">
                    {plan.description[locale]}
                  </p>
                  <ul className="text-muted-foreground mt-4 mb-6 flex-1 space-y-2 text-sm">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f.sl} className="flex items-start gap-2">
                        <CheckCircle2
                          className="text-primary-text mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {f[locale]}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.id === "pro" ? "default" : "outline"}
                    className="w-full"
                  >
                    <Link href="/start">{t.plans.cta}</Link>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground border-border bg-background mx-auto mt-6 max-w-3xl rounded-xl border p-4 text-center text-sm">
              {t.plans.note}
            </p>
          </div>
        </section>

        {/* FAQ / objections */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="text-center text-3xl font-bold">{t.faq.title}</h2>
          <div className="border-border mx-auto mt-10 max-w-3xl border-t">
            {t.faq.items.map((item) => (
              <details
                key={item.q}
                className="group border-border border-b py-4"
              >
                <summary className="hover:text-primary-text flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {item.q}
                  <span
                    className="text-primary-text text-xl leading-none group-open:hidden"
                    aria-hidden="true"
                  >
                    +
                  </span>
                  <span
                    className="text-primary-text hidden text-xl leading-none group-open:inline"
                    aria-hidden="true"
                  >
                    −
                  </span>
                </summary>
                <p className="text-muted-foreground mt-3 text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-primary/95 text-primary-foreground py-16 text-center">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold">{t.final.title}</h2>
            <p className="mx-auto mt-3 max-w-xl opacity-90">{t.final.lead}</p>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-primary mt-7 min-h-12 bg-white hover:bg-white/90"
            >
              <Link href="/start">
                {t.final.cta}
                <ArrowRight className="ml-2 size-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-border/40 border-t py-8">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 text-sm">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} MARKEC – MY BUSINESS PLATFORM ·{" "}
            {t.foot.tag}
          </p>
          <nav aria-label={t.aria.legal} className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              {t.foot.privacy}
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              {t.foot.terms}
            </Link>
            <Link href="/cookies" className="hover:text-foreground">
              {t.foot.cookies}
            </Link>
          </nav>
          <nav aria-label={t.aria.footer} className="flex flex-wrap gap-4">
            <Link href="/login" className="hover:text-foreground">
              {t.foot.login}
            </Link>
            <Link href="/start" className="hover:text-foreground">
              {t.foot.start}
            </Link>
            <Link
              href={otherLangHref}
              hrefLang={isEn ? "sl" : "en"}
              className="hover:text-foreground"
            >
              {isEn ? t.languages.sl : t.languages.en}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
