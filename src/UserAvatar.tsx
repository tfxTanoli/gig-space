import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const sizes = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
};

// Generated listings use the business's logo as their avatar. Logos are square
// and often transparent, so cropping them to fill (object-cover) either clips the
// mark or leaves it invisible against a dark page — they need a white disc and
// room to breathe instead. We can tell them apart by where they're stored.
const isBusinessLogo = (url: string) => url.includes('listingLogos');

const imageClasses = (url: string) =>
  isBusinessLogo(url)
    ? 'bg-white object-contain p-0.5'
    : 'object-cover';

// Shared by both avatars: the initial in a filled circle. This is what a missing
// or broken photo falls back to, so there's always a complete circle on screen.
const Initial = ({ cls, name, interactive }: { cls: string; name?: string; interactive?: boolean }) => (
  <div
    className={`${cls} rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0 ${interactive ? 'cursor-pointer' : ''}`}
  >
    {name?.charAt(0)?.toUpperCase() ?? '?'}
  </div>
);

// Displays the currently logged-in user's real avatar (photo or initial).
export const CurrentUserAvatar = ({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const { userProfile } = useAuth();
  const cls = sizes[size];
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [userProfile?.photoURL]);

  if (userProfile?.photoURL && !broken) {
    return (
      <img
        src={userProfile.photoURL}
        alt={userProfile.name}
        decoding="async"
        onError={() => setBroken(true)}
        className={`${cls} rounded-full ${imageClasses(userProfile.photoURL)} cursor-pointer flex-shrink-0`}
      />
    );
  }

  return <Initial cls={cls} name={userProfile?.name} interactive />;
};

// Displays any user's avatar given explicit photoURL + name props.
export const UserAvatar = ({
  photoURL,
  name,
  size = 'sm',
}: {
  photoURL?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const cls = sizes[size];
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [photoURL]);

  if (photoURL && !broken) {
    return (
      <img
        src={photoURL}
        alt={name ?? 'avatar'}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={`${cls} rounded-full ${imageClasses(photoURL)} flex-shrink-0`}
      />
    );
  }

  return <Initial cls={cls} name={name} />;
};
