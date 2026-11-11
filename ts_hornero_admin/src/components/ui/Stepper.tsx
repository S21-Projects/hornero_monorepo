import { TickCircle } from 'iconsax-reactjs';

interface StepperProps {
  steps: readonly string[];
  /** 0-indexed current step. Steps before it are done. */
  current: number;
  /** Marks every step as completed (e.g. a success screen). */
  allDone?: boolean;
  /** Fill the available width instead of the compact 480px default. */
  fullWidth?: boolean;
}

const CIRCLE = 30;

/** Horizontal numbered stepper with progress connectors. Presentational only. */
export function Stepper({ steps, current, allDone = false, fullWidth = false }: StepperProps) {
  return (
    <ol
      style={{
        display: 'flex',
        listStyle: 'none',
        padding: 0,
        margin: '0 0 24px',
        width: '100%',
        maxWidth: fullWidth ? undefined : 480,
      }}
    >
      {steps.map((label, i) => {
        const done = allDone || i < current;
        const isCurrent = !allDone && i === current;
        const reached = done || isCurrent;
        return (
          <li
            key={label}
            aria-current={isCurrent ? 'step' : undefined}
            data-state={done ? 'done' : isCurrent ? 'current' : 'pending'}
            style={{
              position: 'relative',
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {i > 0 && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: CIRCLE / 2 - 1,
                  left: `calc(-50% + ${CIRCLE / 2 + 6}px)`,
                  right: `calc(50% + ${CIRCLE / 2 + 6}px)`,
                  height: 2,
                  borderRadius: 1,
                  background: reached ? 'var(--horn)' : 'var(--line)',
                }}
              />
            )}
            <div
              aria-hidden="true"
              style={{
                width: CIRCLE,
                height: CIRCLE,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                background: done ? 'var(--horn)' : '#fff',
                color: done ? '#fff' : isCurrent ? 'var(--horn)' : 'var(--ink-3)',
                border: `2px solid ${reached ? 'var(--horn)' : 'var(--line)'}`,
                boxShadow: isCurrent ? '0 0 0 4px var(--straw)' : 'none',
              }}
            >
              {done ? <TickCircle size={18} variant="Bold" color="#fff" /> : i + 1}
            </div>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: isCurrent ? 800 : 600,
                color: isCurrent ? 'var(--earth)' : 'var(--ink-3)',
                textAlign: 'center',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '0 2px',
              }}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
