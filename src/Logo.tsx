import { useId, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { LOGO_GRADIENT, LOGO_MARK_PATH, LOGO_VIEWBOX, LOGO_WORD_PATH } from './content/logo';

const Logo = ({ className, to = '/search', onClick }: { className?: string; to?: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void }) => {
  const uid = useId().replace(/:/g, '');
  const gradientId = `gsg_${uid}`;
  const svg = (
  <svg className={`text-white ${className ?? ''}`} viewBox={LOGO_VIEWBOX} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d={LOGO_MARK_PATH} fill={`url(#${gradientId})`}/>
    <path d={LOGO_WORD_PATH} fill="currentColor"/>
    <defs>
      <linearGradient id={gradientId} x1={LOGO_GRADIENT.x1} y1={LOGO_GRADIENT.y1} x2={LOGO_GRADIENT.x2} y2={LOGO_GRADIENT.y2} gradientUnits="userSpaceOnUse">
        {LOGO_GRADIENT.stops.map((st) => <stop key={st.offset} offset={st.offset} stopColor={st.color} />)}
      </linearGradient>
    </defs>
  </svg>
  );
  return <Link to={to} className="inline-flex items-center" onClick={onClick}>{svg}</Link>;
};

export default Logo;
