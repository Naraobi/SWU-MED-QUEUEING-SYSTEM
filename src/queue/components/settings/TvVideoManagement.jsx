import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MonitorPlay,
  Upload,
  Eye,
  Star,
  MoreVertical,
  Trash2,
  X,
  AlertTriangle,
  UploadCloud,
  Info,
  Film,
} from 'lucide-react';

import { useLanguage } from '../../services/language';

/*
 * =============================================================================
 * TV Video Management
 * =============================================================================
 *
 * Videos that play on the SWUMed TV queue screens. Kept as its own component
 * rather than inlined into Settings so it can be lifted out or swapped whole
 * without touching the rest of the page.
 *
 * A video file is far too large for the browser storage the logo uses, so this
 * section talks to the server directly. Four endpoints, all under the existing
 * API base:
 *
 *   GET    /api/tv-videos                 -> [{ video_id, name, file_name,
 *                                               url, is_default, uploaded_at }]
 *   POST   /api/tv-videos                 multipart: name, file
 *                                         The FIRST video uploaded becomes the
 *                                         default automatically.
 *   PATCH  /api/tv-videos/:id/default     make this one the default
 *   DELETE /api/tv-videos/:id             remove it
 *
 * FOR THE BACKEND TEAM: deleting the current default should promote the next
 * remaining video rather than leaving the TV with no default. The TV screen
 * then reads the same list and plays a random pick of whatever it is given,
 * falling back to the default when nothing is selected.
 *
 * Until those endpoints exist the section shows an empty state naming them,
 * rather than pretending to hold files it cannot keep.
 * =============================================================================
 */

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

const MAX_BYTES = 100 * 1024 * 1024;
const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/x-m4v'];

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatUploaded(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeVideo(row, index) {
  return {
    id: String(row.video_id ?? row.id ?? index),
    name: row.name ?? row.title ?? row.file_name ?? 'Untitled video',
    fileName: row.file_name ?? row.fileName ?? '',
    url: row.url ?? row.file_url ?? '',
    isDefault: Boolean(row.is_default ?? row.isDefault),
    uploadedAt: row.uploaded_at ?? row.uploadedAt ?? row.created_at ?? null,
  };
}

/* =========================================================
   UPLOAD MODAL
========================================================= */

function UploadVideoModal({ onClose, onUpload, uploading, error, isFirst }) {
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const inputRef = useRef(null);

  function accept(candidate) {
    setLocalError('');

    if (!candidate) return;

    const typeOk =
      ACCEPTED.includes(candidate.type) ||
      /\.(mp4|mov|m4v)$/i.test(candidate.name);

    if (!typeOk) {
      setLocalError(t('sa.tv.errorType'));
      return;
    }

    if (candidate.size > MAX_BYTES) {
      setLocalError(t('sa.tv.errorSize'));
      return;
    }

    setFile(candidate);

    // Offer the file name as the title when the field is still empty.
    if (!name.trim()) {
      setName(candidate.name.replace(/\.[^.]+$/, ''));
    }
  }

  const shownError = localError || error;

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={() => !uploading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-video-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="upload-video-title"
              className="text-base font-bold text-[#1F2937]"
            >
              {t('sa.tv.uploadTitle')}
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              {t('sa.tv.uploadSub')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label={t('sa.common.close')}
            className="shrink-0 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label
              htmlFor="tv-video-name"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
            >
              {t('sa.tv.videoName')}
            </label>

            <input
              id="tv-video-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={uploading}
              placeholder={t('sa.tv.videoNamePlaceholder')}
              className="h-10 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:opacity-60"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[#1F2937]">
              {t('sa.tv.videoFile')}
            </span>

            <button
              type="button"
              onClick={() => !uploading && inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                accept(event.dataTransfer.files?.[0]);
              }}
              disabled={uploading}
              className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 transition ${
                dragging
                  ? 'border-[#9D0A0E] bg-[#FBF1F1]'
                  : file
                    ? 'border-[#86EFAC] bg-[#E8F8F0]'
                    : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF] hover:bg-[#F8F9FA]'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {file ? (
                <>
                  <Film size={22} className="text-[#0D8A4E]" />

                  <span className="max-w-full truncate text-xs font-semibold text-[#1F2937]">
                    {file.name}
                  </span>

                  <span className="text-xs text-[#4B5563]">
                    {formatSize(file.size)} &middot; {t('sa.tv.chooseAnother')}
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud size={22} className="text-[#9D0A0E]" />

                  <span className="text-xs font-semibold text-[#1F2937]">
                    {t('sa.tv.dropzone')}
                  </span>

                  <span className="text-xs text-[#9CA3AF]">
                    {t('sa.tv.dropzoneHint')}
                  </span>
                </>
              )}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
              onChange={(event) => {
                accept(event.target.files?.[0]);
                event.target.value = '';
              }}
              className="hidden"
            />
          </div>

          {isFirst && (
            <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-xs leading-5 text-[#4B5563]">
              <Info size={13} className="mt-0.5 shrink-0 text-[#9D0A0E]" />
              {t('sa.tv.firstIsDefault')}
            </div>
          )}

          {shownError && (
            <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-xs text-[#9D0A0E]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {shownError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            {t('sa.common.cancel')}
          </button>

          <button
            type="button"
            onClick={() => onUpload({ name: name.trim(), file })}
            disabled={uploading || !file || !name.trim()}
            className="swu-press inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            <Upload size={13} />
            {uploading ? t('sa.tv.uploading') : t('sa.tv.uploadAction')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PREVIEW MODAL
========================================================= */

function PreviewVideoModal({ video, onClose }) {
  const { t } = useLanguage();

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={video.name}
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-[#1F2937]">
              {video.name}
            </h2>

            {video.fileName && (
              <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">
                {video.fileName}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('sa.common.close')}
            className="shrink-0 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="bg-black">
          {video.url ? (
            <video
              src={video.url}
              controls
              autoPlay
              className="max-h-[70vh] w-full"
            />
          ) : (
            <p className="px-5 py-16 text-center text-xs text-white/70">
              {t('sa.tv.noPreviewUrl')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DELETE CONFIRM
========================================================= */

function DeleteVideoModal({ video, onCancel, onConfirm, deleting }) {
  const { t } = useLanguage();

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={() => !deleting && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="px-6 pb-5 pt-6 text-center">
          <h2 className="text-base font-bold text-[#1F2937]">
            {t('sa.tv.deleteTitle')}
          </h2>

          <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[#4B5563]">
            {t('sa.tv.deleteBody', { name: video.name })}
          </p>

          {video.isDefault && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-left text-xs leading-5 text-[#4B5563]">
              <AlertTriangle
                size={13}
                className="mt-0.5 shrink-0 text-[#9D0A0E]"
              />
              {t('sa.tv.deleteDefaultWarning')}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            {t('sa.common.cancel')}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="swu-press rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? t('sa.tv.deleting') : t('sa.tv.deleteAction')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ROW
========================================================= */

function VideoRow({ video, onPreview, onSetDefault, onDelete, busy }) {
  const { t } = useLanguage();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function away(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [menuOpen]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 transition hover:border-[#F0DADA]">
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          video.isDefault
            ? 'bg-[#FBF1F1] text-[#9D0A0E]'
            : 'bg-[#F1F3F5] text-[#4B5563]'
        }`}
      >
        <Film size={17} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-[#1F2937]">
            {video.name}
          </span>

          {video.isDefault && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-300">
              <Star size={9} strokeWidth={3} />
              {t('sa.tv.default')}
            </span>
          )}
        </p>

        {video.fileName && (
          <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">
            {video.fileName}
          </p>
        )}

        {video.uploadedAt && (
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            {t('sa.tv.uploadedOn', { date: formatUploaded(video.uploadedAt) })}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onPreview(video)}
          className="swu-press inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
        >
          <Eye size={13} />
          {t('sa.tv.preview')}
        </button>

        <button
          type="button"
          onClick={() => onSetDefault(video)}
          disabled={video.isDefault || busy}
          title={video.isDefault ? t('sa.tv.alreadyDefault') : undefined}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            video.isDefault
              ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F1F3F5] text-[#9CA3AF]'
              : 'swu-press border-[#F0DADA] bg-white text-[#9D0A0E] hover:bg-[#FBF1F1]'
          } disabled:cursor-not-allowed`}
        >
          {t('sa.tv.setDefault')}
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t('sa.tv.moreActions')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="rounded-lg p-1.5 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937]"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="swu-pop absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(video);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-[#9D0A0E] transition hover:bg-[#FBF1F1]"
              >
                <Trash2 size={13} />
                {t('sa.tv.deleteAction')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION
========================================================= */

export default function TvVideoManagement() {
  const { t } = useLanguage();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await fetch(`${API_BASE}/tv-videos`);

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const rows = Array.isArray(result) ? result : result?.data ?? [];

      setVideos(rows.map(normalizeVideo));
    } catch (error) {
      setVideos([]);
      setLoadError(error?.message || t('sa.tv.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload({ name, file }) {
    setUploading(true);
    setUploadError('');

    try {
      const body = new FormData();
      body.append('name', name);
      body.append('file', file);

      const response = await fetch(`${API_BASE}/tv-videos`, {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      setShowUpload(false);
      await load();
    } catch (error) {
      setUploadError(error?.message || t('sa.tv.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function handleSetDefault(video) {
    setBusy(true);

    // Move the badge straight away; the reload confirms it.
    setVideos((current) =>
      current.map((item) => ({ ...item, isDefault: item.id === video.id }))
    );

    try {
      const response = await fetch(
        `${API_BASE}/tv-videos/${encodeURIComponent(video.id)}/default`,
        { method: 'PATCH' }
      );

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      await load();
    } catch (error) {
      setLoadError(error?.message || t('sa.tv.defaultFailed'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;

    setDeleting(true);

    try {
      const response = await fetch(
        `${API_BASE}/tv-videos/${encodeURIComponent(pendingDelete.id)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      setPendingDelete(null);
      await load();
    } catch (error) {
      setLoadError(error?.message || t('sa.tv.deleteFailed'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="swu-card rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div className="flex items-start gap-2.5">
          <MonitorPlay size={16} className="mt-0.5 shrink-0 text-[#9D0A0E]" />

          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              {t('sa.tv.title')}
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">{t('sa.tv.subtitle')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setUploadError('');
            setShowUpload(true);
          }}
          className="swu-press inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#9D0A0E] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
        >
          <Upload size={13} />
          {t('sa.tv.uploadAction')}
        </button>
      </div>

      <div className="border-t border-[#E5E7EB] px-6 py-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#4B5563]">
          {t('sa.tv.uploadedVideos')}
        </p>

        {loading && (
          <p className="py-8 text-center text-xs text-[#9CA3AF]">
            {t('sa.tv.loading')}
          </p>
        )}

        {!loading && loadError && (
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-5 text-xs leading-5 text-[#4B5563]">
            <Info size={13} className="mt-0.5 shrink-0 text-[#9CA3AF]" />

            <span>
              {t('sa.tv.unavailable')}

              <span className="mt-1 block font-mono text-xs text-[#9CA3AF]">
                GET {API_BASE}/tv-videos
              </span>

              <button
                type="button"
                onClick={load}
                className="mt-2 font-semibold text-[#9D0A0E] underline"
              >
                {t('sa.common.retry')}
              </button>
            </span>
          </div>
        )}

        {!loading && !loadError && videos.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-8 text-center text-xs text-[#4B5563]">
            {t('sa.tv.empty')}
          </p>
        )}

        {!loading && !loadError && videos.length > 0 && (
          <div className="swu-stagger space-y-2">
            {videos.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                busy={busy}
                onPreview={setPreviewing}
                onSetDefault={handleSetDefault}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadVideoModal
          isFirst={videos.length === 0}
          uploading={uploading}
          error={uploadError}
          onClose={() => !uploading && setShowUpload(false)}
          onUpload={handleUpload}
        />
      )}

      {previewing && (
        <PreviewVideoModal
          video={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}

      {pendingDelete && (
        <DeleteVideoModal
          video={pendingDelete}
          deleting={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  );
}
