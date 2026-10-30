import { type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { imageSize, type ImageSize } from './utils/imageVariants';

type Props = { src: string; size: ImageSize } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

/**
 * An <img> that loads the card- or thumbnail-size version of a photo instead of
 * the full gallery size (see utils/imageVariants.ts). If that version can't be
 * loaded it falls back to the photo itself, so a missing file never leaves a
 * hole. Photos without smaller versions are shown as they are.
 */
export default function SizedImg({ src, size, onError, ...rest }: Props) {
  const handleError = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fullSize !== '1' && img.src !== src) {
      img.dataset.fullSize = '1';
      img.src = src;
    }
    onError?.(e);
  };
  // Keyed by src so a new photo in the same element starts with a clean slate.
  return <img key={src} src={imageSize(src, size)} onError={handleError} {...rest} />;
}
