// Minimal footer — spec §19. No link farm.

export function Footer() {
  return (
    <footer className="border-t border-line py-8 mt-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="font-bold text-ink">FastStudy</p>
          <p className="text-sm text-gray-500 mt-1">
            Don&apos;t just study Japanese. Use Japanese.
          </p>
        </div>
        <p className="text-xs text-gray-400">© 2026 Frank Little</p>
      </div>
    </footer>
  );
}
