import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SizedImg from './SizedImg';
import { hasSizes, thumbImage } from './utils/imageVariants';

export type MediaItem =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string; poster?: string };

interface Props {
  items: MediaItem[];
  /** Alt text for a photo, by its URL. */
  alt: (url: string) => string;
}

/**
 * A post's photos and video: a main viewer with a thumbnail strip beneath it.
 *
 * Post views are the main cost of serving photos, so the gallery loads as little
 * as it can get away with:
 *  - the strip shows every photo straight away, but as its small thumbnail
 *    version, never the full-size file;
 *  - the full-size photo is fetched only for the slide on screen, plus the next
 *    one once the first has loaded, and the rest as someone taps through;
 *  - a video is a preview frame until someone presses play, and only then does
 *    the file download.
 */
export default function MediaGallery({ items, alt }: Props) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The photo whose full-size file has finished loading in the viewer.
  const [loaded, setLoaded] = useState('');

  const index = Math.min(active, items.length - 1);
  const current = items[index];

  const go = (i: number) => { setActive(i); setPlaying(false); };
  const prev = () => go(index === 0 ? items.length - 1 : index - 1);
  const next = () => go(index === items.length - 1 ? 0 : index + 1);

  // Warm the next slide once this one is on screen, so the arrow feels instant
  // without every photo being downloaded up front.
  const upcoming = items.length > 1 ? items[(index + 1) % items.length] : null;
  const upcomingUrl = upcoming?.kind === 'image' ? upcoming.url : '';
  const currentReady = !current || current.kind !== 'image' || loaded === current.url;
  useEffect(() => {
    if (!upcomingUrl || !currentReady) return;
    new Image().src = upcomingUrl;
  }, [upcomingUrl, currentReady]);

  if (!current) return null;

  // The thumbnail the strip already loaded, shown behind the full-size photo so
  // a tap gives an instant (soft) picture rather than an empty box. A lone photo
  // has no strip, so there is nothing loaded to borrow and no reason to fetch one.
  const placeholder = items.length > 1 && current.kind === 'image' && hasSizes(current.url)
    ? { backgroundImage: `url("${thumbImage(current.url)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  return (
    <div className="order-2 mb-8">
      {/* Main viewer — fixed 592×444 on desktop, responsive 4:3 below */}
      <div className="relative rounded-xl overflow-hidden bg-slate-900 mb-3 w-full aspect-[4/3]">
        {current.kind === 'video' ? (
          playing ? (
            <video
              key={current.url}
              src={current.url}
              poster={current.poster}
              controls
              autoPlay
              className="w-full h-full object-cover"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play video"
              className="group relative block w-full h-full"
            >
              {current.poster && (
                <img src={current.poster} alt="" decoding="async" className="w-full h-full object-cover" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                <span className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
                  <Play className="w-7 h-7 text-white fill-white" />
                </span>
              </span>
            </button>
          )
        ) : (
          <img
            key={current.url}
            src={current.url}
            alt={alt(current.url)}
            decoding="async"
            fetchPriority={index === 0 ? 'high' : undefined}
            onLoad={() => setLoaded(current.url)}
            style={placeholder}
            className="w-full h-full object-cover"
          />
        )}

        {/* Prev / Next arrows */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show item ${i + 1}`}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={item.kind === 'video' ? 'Show video' : `Show photo ${i + 1}`}
              className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                i === index ? 'border-primary' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
              style={{ width: 72, height: 54 }}
            >
              {item.kind === 'video' ? (
                <>
                  {item.poster
                    ? <img src={item.poster} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-slate-800" />}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                </>
              ) : (
                <SizedImg src={item.url} size="thumb" alt={alt(item.url)} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
