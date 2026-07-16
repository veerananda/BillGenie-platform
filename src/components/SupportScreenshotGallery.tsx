'use client';

import { useEffect, useState } from 'react';

type SupportScreenshot = {
  data_url: string;
  name: string;
  content_type: string;
};

type SupportScreenshotGalleryProps = {
  screenshots: SupportScreenshot[];
};

function downloadScreenshot(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename || 'support-screenshot.jpg';
  link.click();
}

export function SupportScreenshotGallery({ screenshots }: SupportScreenshotGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveIndex(null);
        return;
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((current) => {
          if (current === null) return current;
          return (current + 1) % screenshots.length;
        });
      }
      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) => {
          if (current === null) return current;
          return (current - 1 + screenshots.length) % screenshots.length;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, screenshots.length]);

  if (!screenshots.length) return null;

  const activeScreenshot = activeIndex === null ? null : screenshots[activeIndex];

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-3">
        {screenshots.map((screenshot, index) => (
          <button
            key={`${screenshot.name}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group overflow-hidden rounded-lg border border-slate-700 bg-slate-950/60 text-left hover:border-slate-500"
          >
            <img
              src={screenshot.data_url}
              alt={screenshot.name || `Screenshot ${index + 1}`}
              className="h-24 w-24 object-cover transition-transform group-hover:scale-105"
            />
            <div className="max-w-24 truncate px-2 py-1 text-xs text-slate-400">
              {screenshot.name || `Screenshot ${index + 1}`}
            </div>
          </button>
        ))}
      </div>

      {activeScreenshot ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {activeScreenshot.name || `Screenshot ${(activeIndex ?? 0) + 1}`}
                </p>
                {screenshots.length > 1 ? (
                  <p className="text-xs text-slate-400">
                    {(activeIndex ?? 0) + 1} of {screenshots.length}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {screenshots.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((current) => {
                          if (current === null) return current;
                          return (current - 1 + screenshots.length) % screenshots.length;
                        })
                      }
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((current) => {
                          if (current === null) return current;
                          return (current + 1) % screenshots.length;
                        })
                      }
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      Next
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    downloadScreenshot(
                      activeScreenshot.data_url,
                      activeScreenshot.name || `support-screenshot-${(activeIndex ?? 0) + 1}.jpg`
                    )
                  }
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[calc(90vh-64px)] overflow-auto p-4">
              <img
                src={activeScreenshot.data_url}
                alt={activeScreenshot.name || `Screenshot ${(activeIndex ?? 0) + 1}`}
                className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
