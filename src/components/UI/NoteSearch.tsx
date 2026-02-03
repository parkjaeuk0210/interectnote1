import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../contexts/StoreProvider';
import { Note } from '../../types';

type SnippetParts = {
  prefixEllipsis: boolean;
  before: string;
  match: string;
  after: string;
  suffixEllipsis: boolean;
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const getTimestamp = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
};

const buildSnippet = (content: string, queryLower: string): SnippetParts => {
  const normalized = normalizeText(content);

  if (!queryLower) {
    const truncated = normalized.slice(0, 90);
    return {
      prefixEllipsis: false,
      before: truncated,
      match: '',
      after: '',
      suffixEllipsis: truncated.length < normalized.length,
    };
  }

  const lower = normalized.toLowerCase();
  const idx = lower.indexOf(queryLower);
  if (idx === -1) {
    const truncated = normalized.slice(0, 90);
    return {
      prefixEllipsis: false,
      before: truncated,
      match: '',
      after: '',
      suffixEllipsis: truncated.length < normalized.length,
    };
  }

  const contextBefore = 30;
  const contextAfter = 45;
  const start = Math.max(0, idx - contextBefore);
  const end = Math.min(normalized.length, idx + queryLower.length + contextAfter);
  const snippet = normalized.slice(start, end);
  const localIdx = idx - start;

  return {
    prefixEllipsis: start > 0,
    before: snippet.slice(0, localIdx),
    match: snippet.slice(localIdx, localIdx + queryLower.length),
    after: snippet.slice(localIdx + queryLower.length),
    suffixEllipsis: end < normalized.length,
  };
};

export const NoteSearch: React.FC = () => {
  const notes = useAppStore((state) => state.notes);
  const viewport = useAppStore((state) => state.viewport);
  const setViewport = useAppStore((state) => state.setViewport);
  const selectNote = useAppStore((state) => state.selectNote);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const queryLower = useMemo(() => query.trim().toLowerCase(), [query]);

  const results = useMemo(() => {
    if (!queryLower) return [];

    return notes
      .filter((note) => normalizeText(note.content || '').toLowerCase().includes(queryLower))
      .sort((a, b) => getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt));
  }, [notes, queryLower]);

  const jumpToNote = useCallback(
    (note: Note) => {
      const scale = Math.max(0.0001, viewport.scale || 1);
      const noteWidth = Math.max(1, note.width || 1);
      const noteHeight = Math.max(1, note.height || 1);
      const noteCenterX = (note.x || 0) + noteWidth / 2;
      const noteCenterY = (note.y || 0) + noteHeight / 2;

      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;

      setViewport({
        scale,
        x: screenCenterX - noteCenterX * scale,
        y: screenCenterY - noteCenterY * scale,
      });

      // Select without changing z-index (avoids unintended writes in Firebase/shared modes).
      selectNote(note.id, { bringToFront: false });
    },
    [selectNote, setViewport, viewport.scale],
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  // Focus input on open.
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Keyboard shortcuts: Ctrl/Cmd+K to open, Esc to close, Enter to jump to first result.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') return true;
      return node.isContentEditable === true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey && !e.altKey) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        open();
        return;
      }

      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === 'Enter') {
        if (isTypingTarget(e.target)) return;
        if (queryLower && results.length > 0) {
          e.preventDefault();
          jumpToNote(results[0]);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, isOpen, jumpToNote, open, queryLower, results]);

  const overlay = isOpen ? (
    <div
      className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[2px] flex items-start justify-center p-4 pt-20"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="메모 검색"
    >
      <div className="w-full max-w-xl">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-3">
            <div className="flex items-center gap-2">
              <div className="text-gray-500 dark:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="메모 내용 검색…"
                className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm sm:text-base"
                aria-label="메모 검색 입력"
              />
              {query.length > 0 && (
                <button
                  onClick={clear}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
                  title="지우기"
                  aria-label="검색어 지우기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                onClick={close}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
                title="닫기 (Esc)"
                aria-label="검색 닫기"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {queryLower
                  ? `결과 ${results.length}개 / 전체 ${notes.length}개`
                  : `전체 ${notes.length}개 · Ctrl/⌘+K`}
              </span>
              {queryLower && results.length > 0 && <span>Enter: 첫 결과로 이동</span>}
            </div>
          </div>

          {queryLower && (
            <div className="border-t border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-y-auto">
              {results.length === 0 ? (
                <div className="p-4 text-sm text-gray-600 dark:text-gray-300">검색 결과가 없습니다.</div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {results.slice(0, 30).map((note) => {
                    const snippet = buildSnippet(note.content || '', queryLower);
                    return (
                      <button
                        key={note.id}
                        onClick={() => jumpToNote(note)}
                        className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        <div className="text-sm text-gray-900 dark:text-white leading-snug">
                          {snippet.prefixEllipsis ? '…' : ''}
                          {snippet.before}
                          {snippet.match && (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">{snippet.match}</span>
                          )}
                          {snippet.after}
                          {snippet.suffixEllipsis ? '…' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={open}
        className={`glass-button rounded-full p-3 hover:scale-105 transition-transform text-gray-700 dark:text-gray-200 ${
          isOpen ? 'bg-blue-500 bg-opacity-20' : ''
        }`}
        title="검색 (Ctrl/⌘+K)"
        aria-label="메모 검색 열기"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
      {overlay && (typeof document === 'undefined' ? overlay : createPortal(overlay, document.body))}
    </>
  );
};

