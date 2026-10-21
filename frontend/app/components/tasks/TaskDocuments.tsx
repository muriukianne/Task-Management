'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getTaskDocuments,
  uploadTaskDocument,
  deleteTaskDocument,
  downloadTaskDocument,
  ApiError,
  type TaskDocument,
} from '../../lib/api';
import { RoleBadge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';

const ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface TaskDocumentsProps {
  taskId: number;
  active?: boolean;
  currentUserId?: number | null;
  isPrivileged?: boolean;
  /** Refresh parent task (e.g. attachedFile badge) after upload/delete. */
  onChanged?: () => void;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T')).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function TaskDocuments({
  taskId,
  active = true,
  currentUserId = null,
  isPrivileged = false,
  onChanged,
}: TaskDocumentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<TaskDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active || !taskId) {
      setDocs([]);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getTaskDocuments(taskId)
      .then((rows) => {
        if (!cancelled) setDocs(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setDocs([]);
          setError(err instanceof ApiError ? err.message : 'Could not load documents');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [active, taskId]);

  async function handleUpload(file: File | null | undefined) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const created = await uploadTaskDocument(taskId, file);
      setDocs((prev) => [created, ...prev]);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDownload(doc: TaskDocument) {
    setBusyId(doc.id);
    setError('');
    try {
      await downloadTaskDocument(taskId, doc.id, doc.originalName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Download failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(doc: TaskDocument) {
    const canDelete = isPrivileged || (currentUserId != null && doc.uploadedBy === currentUserId);
    if (!canDelete) return;
    if (!window.confirm(`Delete “${doc.originalName}”?`)) return;

    setBusyId(doc.id);
    setError('');
    try {
      await deleteTaskDocument(taskId, doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pt-2 border-t border-[var(--border)] space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Documents</h3>
        <span className="text-[10px] text-[var(--text-muted)]">
          PDF, images, text, Word · max 10 MB
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void handleUpload(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload document'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic">
          No documents attached yet. Upload specs, screenshots, or deliverables here.
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => {
            const canDelete =
              isPrivileged || (currentUserId != null && doc.uploadedBy === currentUserId);
            const busy = busyId === doc.id;
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5"
              >
                <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M4 2h5l3 3v9H4V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={doc.originalName}>
                    {doc.originalName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {fmtSize(doc.sizeBytes)} · {fmtWhen(doc.createdAt)}
                    </span>
                    {doc.uploaderName && (
                      <span className="text-[10px] text-[var(--text-muted)] truncate">
                        by {doc.uploaderName}
                      </span>
                    )}
                    {doc.uploaderRole && <RoleBadge role={doc.uploaderRole} />}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDownload(doc)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                  >
                    {busy ? '…' : 'Download'}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(doc)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
