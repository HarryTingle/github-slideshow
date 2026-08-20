'use client';

import { takeSnapshot, type Audience, type Engagement, type Snapshot } from '@scope/engine';
import { useCallback, useEffect, useState } from 'react';

/**
 * Issued packs.
 *
 * Deliberately not part of the model store. A snapshot is a record of something that
 * left the building, so undo must not take one back, Reset must not clear one, and an
 * edit to the model must not reach into one. Separate state, separate storage key.
 */

const STORAGE_KEY = 'scope.snapshots.v1';

/**
 * How many packs we keep. Each carries a full engagement document, and the browser's
 * storage is shared with the working model — so this is a real ceiling, not a tidy-up.
 */
export const SNAPSHOT_LIMIT = 12;

export interface IssueForm {
  scenarioId: string;
  audience: Audience;
  issuedBy: string;
  note?: string;
}

export interface SnapshotsValue {
  /** Newest first. */
  snapshots: Snapshot[];
  hydrated: boolean;
  issue: (engagement: Engagement, form: IssueForm) => Snapshot | null;
  remove: (id: string) => void;
  /** Set when the browser refused to store a pack, so the UI can say so. */
  storageError: string | null;
}

export function useSnapshots(): SnapshotsValue {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setSnapshots(JSON.parse(saved) as Snapshot[]);
    } catch {
      // A corrupt store of past packs must not stop the app loading.
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Snapshot[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError(null);
    } catch {
      setStorageError(
        'The browser would not store this pack — it is on screen, but it will not survive a reload. Delete an older one and issue it again.',
      );
    }
  }, []);

  const issue = useCallback(
    (engagement: Engagement, form: IssueForm) => {
      if (snapshots.length >= SNAPSHOT_LIMIT) {
        setStorageError(
          `${SNAPSHOT_LIMIT} packs is the limit while these live in the browser. Delete one to issue another.`,
        );
        return null;
      }
      const snapshot = takeSnapshot(engagement, {
        ...form,
        at: new Date().toISOString(),
        existing: snapshots,
      });
      const next = [snapshot, ...snapshots];
      setSnapshots(next);
      persist(next);
      return snapshot;
    },
    [snapshots, persist],
  );

  const remove = useCallback(
    (id: string) => {
      const next = snapshots.filter((snapshot) => snapshot.id !== id);
      setSnapshots(next);
      persist(next);
    },
    [snapshots, persist],
  );

  return { snapshots, hydrated, issue, remove, storageError };
}

export function formatIssuedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
