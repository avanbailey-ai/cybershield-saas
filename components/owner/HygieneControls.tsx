'use client';

import { useState } from 'react';

export default function HygieneControls({
  onArchive,
  onUnarchive,
  onDelete,
  archived,
  compact,
}: {
  onArchive?: () => Promise<void>;
  onUnarchive?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  archived?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const btn =
    'text-xs font-medium disabled:opacity-50 ' +
    (compact ? 'px-2 py-1' : 'px-2.5 py-1 rounded border border-gray-700');

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-1'}`}>
      {archived && onUnarchive && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(onUnarchive)}
          className={`${btn} text-emerald-400 hover:text-emerald-300`}
        >
          Unarchive
        </button>
      )}
      {!archived && onArchive && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(onArchive)}
          className={`${btn} text-gray-400 hover:text-white`}
        >
          Archive
        </button>
      )}
      {onDelete &&
        (confirmDelete ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(onDelete)}
              className={`${btn} text-red-400 hover:text-red-300`}
            >
              Confirm delete
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
              className={`${btn} text-gray-500`}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className={`${btn} text-red-400/80 hover:text-red-400`}
          >
            Delete
          </button>
        ))}
    </div>
  );
}
