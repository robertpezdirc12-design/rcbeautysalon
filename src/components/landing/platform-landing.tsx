import Link from "next/link"
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { listProfileOptions } from "@/lib/profiles/registry"
import { PLANS } from "@/lib/plans/registry"

// ============================================================
// P1 #66 — PLATFORM LANDING (the product's front door).
// The bare "/" on a platform host is the PRODUCT, not the oldest
// tenant. One-line positioning, all activities from the registry as
// deep-link cards (/start?vertical=<id>), 3-step "kako deluje", plans,
// single primary CTA into the wizard. Trade-neutral copy (no "salon").
// Server component — no tenant data, no session requirement.
// ============================================================

export function PlatformLanding() {
  const activities = listProfileOptions()

  return (
    <div className="from-background via-background to-muted/40 min-h-screen bg-linear-to-b">
      {/* Header */}
      <header className="border-border/40 sticky top-0 z-40 border-b bg-white/80 backdrop-blur dark:bg-background/80">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo variant="navbar" />
          </Link>
          <nav aria-label="Platforma" className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="min-h-11">
              <Link href="/login">Prijava</Link>
            </Button>
            <Button asChild size="sm" className="min-h-11 shadow-md">
              <Link href="/start">Začni brezplačno</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero — #112 UX: vstopni CTA mora biti VIDEN v prvem ekranu.
            lastnik (7. 11. 2026) — STRATEŠKA USMERITEV: MARKEC ni izdelovalec
            spletnih strani, ampak sistem za CELOTNO spletno poslovno
            prisotnost podjetnika. Hero pove model: vstop z računom → vse
            predpripravljeno → uredi v svojem prostoru → predogled → objava →
            stranke javno rezervirajo in kupujejo. */}
        <section className="container mx-auto px-4 pt-10 pb-10 text-center md:pt-14">
          <p className="text-primary-text mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium">
            <Sparkles className="size-4" aria-hidden="true" />
            MARKEC – MY BUSINESS PLATFORM
          </p>
          <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Tvoje podjetje. Tvoja spletna stran. Tvoje stranke.{" "}
            <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
              Tvoja platforma.
            </span>
          </h1>
          <p className="text-muted-foreground mt-2 text-xs font-medium tracking-[0.2em] uppercase">
            Your Business. Your Website. Your Customers. Your Platform.
          </p>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base md:text-lg">
            MARKEC ni samo še en izdelovalec spletnih strani — je enostaven
            sistem, v katerem podjetnik brez programiranja upravlja celotno
            svojo spletno poslovno prisotnost.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="min-h-12 shadow-lg">
              <Link href="/start">
                Ustvari svoje podjetje — brezplačno
                <ArrowRight className="ml-2 size-5" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="min-h-12">
              <Link href="#dejavnosti">Poglej dejavnosti</Link>
            </Button>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Brez kartice · V 3 korakih · Spletna stran, trgovina in rezervacije
            so predpripravljene
          </p>
        </section>

        {/* Activities — deep-link cards into the wizard */}
        <section id="dejavnosti" className="container mx-auto px-4 py-12">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">Neobvezna izbira dejavnosti</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
              Dejavnost je samo pomočnik pri začetni nastavitvi — lahko jo
              preskočite. Vsaka predloga prinese pripravljen katalog, obrazce
              in besedila, ki jih poljubno spreminjate.
            </p>
          </div>
          <ul className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/start?vertical=${v.id}`}
                  className="group border-border/60 hover:border-primary/40 hover:shadow-primary/10 flex h-full flex-col justify-between rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md"
                >
                  <div>
                    <h3 className="group-hover:text-primary-text text-lg font-semibold">
                      {v.label}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {v.description}
                    </p>
                  </div>
                  <span className="text-primary-text mt-4 inline-flex items-center gap-1 text-sm font-medium">
                    Začni z {v.label.toLowerCase()}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works — lastnik (7. 11. 2026): tok po njegovem opisu:
            vstop z računom → vse predpripravljeno → uredi v svojem prostoru
            → predogled → objava → stranke javno rezervirajo/kupujejo. */}
        <section className="border-border/40 bg-muted/30 border-t py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold">Kako deluje</h2>
            <ol className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-3">
              {[
                {
                  title: "Vstopite z računom",
                  text: "Prijava in vse je pripravljeno: predpripravljena spletna stran, trgovina, rezervacije, slike in katalogi za vašo dejavnost.",
                },
                {
                  title: "Uredite v svojem prostoru",
                  text: "Besedila, slike, cene in urnik spreminjate sami — vse znotraj vašega prostora. Vsako spremembo pred objavo vidite v predogledu.",
                },
                {
                  title: "Objavite — stranke pridejo",
                  text: "Z enim klikom gre stran na splet. Vaše stranke javno rezervirajo termine, naročajo iz trgovine in vas najdejo na spletu.",
                },
              ].map((s, i) => (
                <li key={s.title} className="text-center">
                  <div className="bg-primary/10 text-primary-text mx-auto mb-4 flex size-12 items-center justify-center rounded-full text-xl font-bold">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Plans */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="text-center text-3xl font-bold">Preprosti paketi</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-center">
            Začnite brezplačno in nadgradite, ko vaše podjetje raste.
          </p>
          <ul className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            {Object.values(PLANS).map((plan) => (
              <li
                key={plan.id}
                className="border-border/60 rounded-xl border bg-card p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold">{plan.label}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {plan.description.sl}
                </p>
                <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f.sl} className="flex items-start gap-2">
                      <CheckCircle2
                        className="text-primary-text mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {f.sl}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-4 pb-20 text-center">
          <h2 className="text-3xl font-bold">Pripravljeni na začetek?</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-lg">
            Ustvarite svojo stran brezplačno — objavite, ko boste zadovoljni
            s podobo in vsebino.
          </p>
          <Button asChild size="lg" className="min-h-12 mt-6 shadow-lg">
            <Link href="/start">
              Ustvari svoje podjetje
              <ArrowRight className="ml-2 size-5" aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>

      {/* Minimal platform footer */}
      <footer className="border-border/40 border-t py-8">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} MARKEC – MY BUSINESS PLATFORM</p>
          <nav aria-label="Platformske povezave" className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Prijava
            </Link>
            <Link href="/start" className="hover:text-foreground">
              Ustvari podjetje
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
