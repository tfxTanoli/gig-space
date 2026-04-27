import { useAuth } from './AuthContext';

const sizes = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
};

// Displays the currently logged-in user's real avatar (photo or initial).
// Use this everywhere you need to show the signed-in user.
export const CurrentUserAvatar = ({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const { userProfile } = useAuth();
  const cls = sizes[size];

  if (userProfile?.photoURL) {
    return (
      <img
        src={userProfile.photoURL}
        alt={userProfile.name}
        className={`${cls} rounded-full object-cover cursor-pointer flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${cls} rounded-full bg-primary flex items-center justify-center text-white font-semibold cursor-pointer flex-shrink-0`}>
      {userProfile?.name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  );
};

// Displays any user's avatar given explicit photoURL + name props.
// Use this for seller/buyer cards in listings.
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

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name ?? 'avatar'}
        className={`${cls} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${cls} rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  );
};
