export default function Home() {
  return (
    <div className="min-h-[calc(100dvh-8rem)] flex items-center justify-center px-4 py-6">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-pink-100 bg-gradient-to-b from-pink-50 via-white to-white shadow-xl shadow-pink-200/40 px-6 py-12 sm:px-12 sm:py-16 text-center">
        {/* Dekorasi lingkaran lembut */}
        <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-pink-200/40 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-rose-200/40 blur-2xl" />

        <div className="relative flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Meyriana Collection"
            className="w-40 h-40 sm:w-56 sm:h-56 object-contain drop-shadow-lg"
          />

          <h1 className="mt-8 font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-on-surface">
            Meyriana Collection
          </h1>
          <p className="mt-2 text-base sm:text-lg text-on-surface-variant tracking-wide">
            Management System
          </p>
        </div>
      </div>
    </div>
  );
}
