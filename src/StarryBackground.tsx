import { useTheme } from './theme';

const STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  duration: Math.random() * 4 + 2,
  delay: Math.random() * 5,
}));

/** Dark mode: the starry night sky behind the landing heroes. */
const StarryNight = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {STARS.map(s => (
      <div
        key={s.id}
        className="absolute rounded-full bg-white"
        style={{
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: `${s.size}px`,
          height: `${s.size}px`,
          animation: `twinkle ${s.duration}s ${s.delay}s infinite ease-in-out`,
        }}
      />
    ))}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse 80% 55% at 50% 0%, rgba(59,130,246,0.13) 0%, transparent 70%)',
        animation: 'glow-pulse 5s infinite ease-in-out',
      }}
    />
  </div>
);

// Literal colours on purpose: in light mode the blue-300/-400 variables are
// re-pointed at deeper shades for text, but this glow wants the real pale ones.
const BLUE_300 = '147, 197, 253';
const BLUE_200 = '191, 219, 254';

/**
 * Light mode (GIG-73): a glowing daytime atmosphere instead of stars. A soft
 * blue glow comes in from the left, right and bottom edges and fades to white
 * toward the middle, so the headline sits on clean white; the bottom fades into
 * the page colour so there is no line where the next section starts.
 */
const DaytimeGlow = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ background: 'var(--color-background)' }}>
    <div
      className="absolute"
      style={{
        inset: '-10%',
        background: [
          `radial-gradient(ellipse 34% 62% at 0% 58%, rgba(${BLUE_300}, 0.55) 0%, rgba(${BLUE_200}, 0.28) 45%, transparent 75%)`,
          `radial-gradient(ellipse 34% 62% at 100% 58%, rgba(${BLUE_300}, 0.55) 0%, rgba(${BLUE_200}, 0.28) 45%, transparent 75%)`,
          `radial-gradient(ellipse 70% 34% at 50% 88%, rgba(${BLUE_300}, 0.45) 0%, rgba(${BLUE_200}, 0.25) 50%, transparent 80%)`,
        ].join(', '),
        filter: 'blur(28px)',
        animation: 'glow-pulse 6s infinite ease-in-out',
      }}
    />
    {/* Keep the space behind the hero text clean white. */}
    <div
      className="absolute inset-0"
      style={{ background: 'radial-gradient(ellipse 46% 42% at 50% 36%, #ffffff 0%, rgba(255,255,255,0.85) 45%, transparent 75%)' }}
    />
    {/* Fade fully into the page below. Solid for the last stretch, not just the
        last pixel, so no trace of blue meets the next section as a line. */}
    <div
      className="absolute inset-x-0 bottom-0 h-[45%]"
      style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--color-background) 78%)' }}
    />
  </div>
);

const StarryBackground = () => (useTheme() === 'light' ? <DaytimeGlow /> : <StarryNight />);

export default StarryBackground;
