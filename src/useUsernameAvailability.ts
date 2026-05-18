import { useState, useEffect } from 'react';
import { normalizeUsername, validateUsername, isUsernameAvailable } from './username';

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export interface UsernameCheck {
  status: UsernameStatus;
  message: string;
}

/**
 * Debounced, live username availability check.
 * `currentUid` lets a user keep the username they already own (e.g. in settings).
 *
 * The synchronous part (empty / format validation) is derived during render;
 * only the async network result is held in state.
 */
export function useUsernameAvailability(username: string, currentUid?: string): UsernameCheck {
  const value = normalizeUsername(username);
  const validationError = value ? validateUsername(value) : null;

  // Result of the last completed network check, tagged with the value it was for.
  const [remote, setRemote] = useState<{ value: string; available: boolean } | null>(null);

  useEffect(() => {
    if (!value || validationError) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(value, currentUid);
        if (!cancelled) setRemote({ value, available });
      } catch {
        if (!cancelled) setRemote(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, validationError, currentUid]);

  if (!value) return { status: 'idle', message: '' };
  if (validationError) return { status: 'invalid', message: validationError };
  if (remote && remote.value === value) {
    return remote.available
      ? { status: 'available', message: '' }
      : { status: 'taken', message: 'This username is already taken.' };
  }
  return { status: 'checking', message: '' };
}
