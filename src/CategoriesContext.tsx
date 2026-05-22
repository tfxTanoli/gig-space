import { useEffect, useState, type ReactNode } from 'react';
import { ref, get } from 'firebase/database';
import { database } from './firebase';
import type { CategoryOption } from './categories';

// Module-level singleton — fetched once, shared across all hook consumers.
let _categoryOptions: CategoryOption[] = [];
let _subcategoryMap: Record<string, CategoryOption[]> = {};
let _loaded = false;
let _fetchPromise: Promise<void> | null = null;
const _listeners = new Set<() => void>();

function notifyListeners() {
  _listeners.forEach((fn) => fn());
}

function fetchOnce(): Promise<void> {
  if (_loaded || _fetchPromise) return _fetchPromise ?? Promise.resolve();

  _fetchPromise = Promise.all([
    get(ref(database, 'categories')),
    get(ref(database, 'subcategories')),
  ])
    .then(([catSnap, subSnap]) => {
      const catData =
        (catSnap.val() as Record<string, { label: string; order: number }> | null) ?? {};
      const subData =
        (subSnap.val() as Record<
          string,
          Record<string, { label: string; order: number }>
        > | null) ?? {};

      _categoryOptions = Object.entries(catData)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([value, d]) => ({ value, label: d.label }));

      _subcategoryMap = {};
      for (const [catValue, subs] of Object.entries(subData)) {
        _subcategoryMap[catValue] = Object.entries(subs)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([value, d]) => ({ value, label: d.label }));
      }

      _loaded = true;
      notifyListeners();
    })
    .catch(console.error);

  return _fetchPromise;
}

// Start fetching immediately when this module is first imported.
fetchOnce();

export function useCategories() {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (_loaded) return;
    const trigger = () => rerender((n) => n + 1);
    _listeners.add(trigger);
    fetchOnce();
    return () => { _listeners.delete(trigger); };
  }, []);

  const getCategoryLabel = (value: string) =>
    _categoryOptions.find((c) => c.value === value)?.label ?? value;

  const getSubcategoryLabel = (category: string, value: string) =>
    _subcategoryMap[category]?.find((s) => s.value === value)?.label ?? value;

  return {
    categoryOptions: _categoryOptions,
    subcategoryMap: _subcategoryMap,
    getCategoryLabel,
    getSubcategoryLabel,
    loading: !_loaded,
  };
}

// Keep CategoriesProvider as a no-op so App.tsx import still compiles.
export function CategoriesProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
