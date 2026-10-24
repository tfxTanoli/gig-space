/** One tile in AdminImageGrid. */
export interface GridImage {
  /** Stable identity for keys and dragging: the URL of a saved image, a generated id for a new one. */
  id: string;
  /** What the tile shows: the saved URL, or a local preview of a file not uploaded yet. */
  src: string;
  /** Present for an image picked in this session; uploaded on save. */
  file?: File;
}

let nextId = 0;

/** Tiles for files just picked; the grid frees their previews when they go. */
export const filesToGridImages = (files: File[]): GridImage[] =>
  files.map((file) => ({ id: `new-${nextId++}`, src: URL.createObjectURL(file), file }));

/** Tiles for a post's saved image URLs. */
export const urlsToGridImages = (urls: string[]): GridImage[] => urls.map((url) => ({ id: url, src: url }));
