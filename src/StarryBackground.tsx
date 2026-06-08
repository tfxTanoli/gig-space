const STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  duration: Math.random() * 4 + 2,
  delay: Math.random() * 5,
}));

const StarryBackground = () => (
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

export default StarryBackground;
