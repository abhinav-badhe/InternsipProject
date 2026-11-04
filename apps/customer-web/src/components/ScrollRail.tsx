import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollRailProps {
  label: string;
  children: ReactNode;
}

export function ScrollRail({ label, children }: ScrollRailProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, overflow: false });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const start = viewport.scrollLeft <= 1;
      const end = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1;
      const overflow = viewport.scrollWidth > (viewport.parentElement?.clientWidth || viewport.clientWidth) + 1;
      setEdges((previous) => previous.start === start && previous.end === end && previous.overflow === overflow ? previous : { start, end, overflow });
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    if (viewport.parentElement) observer.observe(viewport.parentElement);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    viewport.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  const scroll = (direction: number) => {
    const viewport = viewportRef.current;
    viewport?.scrollBy({
      left: direction * viewport.clientWidth * 0.7,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div ref={viewportRef} role="region" aria-label={label} tabIndex={0}
        className="scrollbar-none min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-md focus-visible:-outline-offset-2">
        <div className="flex w-max min-w-full items-center gap-1 py-1 [&_a]:focus-visible:-outline-offset-2 [&_button]:focus-visible:-outline-offset-2">
          {children}
        </div>
      </div>
      {edges.overflow && (
        <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2">
          <button type="button" aria-label={`Scroll ${label.toLowerCase()} left`} disabled={edges.start}
            onClick={() => scroll(-1)} className="flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-default disabled:opacity-25">
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button type="button" aria-label={`Scroll ${label.toLowerCase()} right`} disabled={edges.end}
            onClick={() => scroll(1)} className="flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-default disabled:opacity-25">
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
