import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  count?: ReactNode;
  content: ReactNode;
}

// Inactive tabs stay mounted (hidden), so a half-filled form or an open dialog survives a switch.
export function SidebarTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const next = (index + step + tabs.length) % tabs.length;
    setActive(tabs[next]!.id);
    buttons.current[next]?.focus();
  };

  return (
    <div className="flex min-h-0 flex-col rounded-lg bg-white ring-1 ring-slate-200">
      <div role="tablist" className="m-3 mb-0 flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[index] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                selected
                  ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              {tab.label}
              {tab.count}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

export function TabCount({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-slate-200 px-1.5 text-xs font-medium tabular-nums text-slate-700">
      {value}
    </span>
  );
}
