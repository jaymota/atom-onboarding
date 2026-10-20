export default function App() {
  return (
    <main className="flex min-h-svh flex-col">
      <div className="h-1.5 bg-gradient-to-r from-atom-red to-atom-yellow" />

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <img src="/atom-logo.png" alt="Atom Consultancy" className="w-56 sm:w-72" />

        <p className="mt-10 text-sm font-medium uppercase tracking-[0.3em] text-atom-red">
          Coming soon
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
          Start your product journey with us
        </h1>
        <p className="mt-4 max-w-lg text-base text-neutral-600">
          We're building a simple way to share your product idea, receive your scope of work and get
          started, all in one place. From Concept to Shelf.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href="mailto:jay@atomconsulting.in"
            className="rounded-md bg-atom-red px-6 py-3 font-medium text-white transition hover:bg-atom-red/90"
          >
            Email us
          </a>
          <a
            href="https://www.atomconsulting.in"
            className="rounded-md border border-neutral-300 px-6 py-3 font-medium transition hover:border-atom-ink"
          >
            Visit our website
          </a>
        </div>
      </section>

      <footer className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-500">
        Atom Consultancy · Food. Science. Strategy. · Mumbai
      </footer>
    </main>
  )
}
