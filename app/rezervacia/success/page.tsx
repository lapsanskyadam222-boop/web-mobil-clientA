// app/rezervacia/success/page.tsx
export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="text-2xl font-bold mb-3">Rezervácia odoslaná ✅</h1>
      <p className="text-gray-700 mb-6">
        Ďakujem! Čoskoro sa ti ozvem s potvrdením. Medzitým sa môžeš vrátiť na
        <a className="underline ml-1" href="/">homepage</a>.
      </p>
      <a
        href="/"
        className="inline-block rounded-xl bg-black px-6 py-3 text-white hover:bg-gray-800 transition"
      >
        Späť na úvod
      </a>
    </main>
  );
}
