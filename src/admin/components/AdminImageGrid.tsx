import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { type GridImage } from './gridImages';

const isVideo = (img: GridImage) =>
  img.file ? img.file.type.startsWith('video/') : /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(img.src);

interface Props {
  items: GridImage[];
  onChange: (items: GridImage[]) => void;
  onAddClick: () => void;
}

/**
 * A post's images in display order (GIG-74). The first is the cover: it leads
 * the post's gallery and its search card. Drag a tile to move it, or use "Set
 * cover"; on a focused tile the arrow keys move it too. Built on pointer
 * events rather than HTML drag-and-drop so it also works on touch screens.
 */
export default function AdminImageGrid({ items, onChange, onAddClick }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const press = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);

  // Local previews hold the picked file in memory until revoked: free each one
  // when its tile is removed, and the rest when the drawer closes.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const live = new Set(items.filter((i) => i.file).map((i) => i.src));
    for (const url of previews.current) if (!live.has(url)) URL.revokeObjectURL(url);
    previews.current = live;
  }, [items]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    press.current = { id, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p) return;
    // A few pixels of slack, so a click doesn't turn into a drag.
    if (!p.moved) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
      p.moved = true;
      setDraggingId(p.id);
    }
    // The tile under the pointer takes the dragged tile's place, live.
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-grid-image]');
    const overId = over?.dataset.gridImage;
    if (!overId || overId === p.id) return;
    move(items.findIndex((i) => i.id === p.id), items.findIndex((i) => i.id === overId));
  };

  const endDrag = () => {
    press.current = null;
    setDraggingId(null);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(index, index - 1); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(index, index + 1); }
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {items.map((img, i) => (
          <div
            key={img.id}
            data-grid-image={img.id}
            tabIndex={0}
            aria-label={`Image ${i + 1} of ${items.length}${i === 0 ? ', cover' : ''}. Drag or use the arrow keys to reorder.`}
            onPointerDown={(e) => onPointerDown(e, img.id)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`group relative aspect-square rounded-lg overflow-hidden border bg-slate-800 select-none touch-none cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              img.file ? 'border-blue-500/40' : 'border-slate-700'
            } ${draggingId === img.id ? 'opacity-60 ring-2 ring-blue-500' : ''}`}
          >
            {isVideo(img) ? (
              <video src={img.src} muted className="w-full h-full object-cover pointer-events-none" />
            ) : (
              <img src={img.src} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
            )}

            {i === 0 ? (
              <span className="absolute top-1.5 left-1.5 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">Cover</span>
            ) : (
              <button
                type="button"
                onClick={() => move(i, 0)}
                className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity hover:bg-black/90"
              >
                Set cover
              </button>
            )}

            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x.id !== img.id))}
              aria-label={`Remove image ${i + 1}`}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddClick}
          aria-label="Add images"
          className="aspect-square rounded-lg border-2 border-dashed border-slate-700 hover:border-blue-500/50 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors"
        >
          <Upload className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Drag images to reorder. The first is the cover, shown first on the post and in search results.
      </p>
    </>
  );
}
