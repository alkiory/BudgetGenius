/**
 * Ambient shell for every authenticated screen. The visual work lives in
 * `index.css` (`.app-ambient` + `.ambient-orb`) so the animation stays
 * transform/opacity-only and is fully disabled under
 * `prefers-reduced-motion`.
 */
export function AmbientBackground() {
  return (
    <div className="app-ambient" aria-hidden="true">
      <div className="ambient-orb ambient-orb-teal" />
      <div className="ambient-orb ambient-orb-cyan" />
      <div className="ambient-orb ambient-orb-amber" />
    </div>
  );
}
