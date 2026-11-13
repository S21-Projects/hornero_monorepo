import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DepartamentoProps } from '../../lib/vulnerabilidad';

const MAX_RESULTS = 8;
const DEFAULT_PROVINCE = 'Córdoba';

interface Props {
  id: string;
  departamentos: DepartamentoProps[];
  selected: DepartamentoProps | null;
  disabled: boolean;
  onSelect: (p: DepartamentoProps) => void;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function labelOf(d: DepartamentoProps): string {
  return d.nombre ?? `Departamento ${d.codigo}`;
}

export default function DepartamentoCombobox({ id, departamentos, selected, disabled, onSelect }: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the input in sync with the departamento picked on the map.
  useEffect(() => {
    setQuery(selected ? labelOf(selected) : '');
  }, [selected]);

  const indexed = useMemo(
    () =>
      departamentos
        .map((d) => ({ d, key: normalize(labelOf(d)) }))
        .sort((a, b) => a.key.localeCompare(b.key, 'es')),
    [departamentos],
  );

  const results = useMemo(() => {
    const q = normalize(query);
    // The input shows the selected name; treat that as "no filter" until the user edits it.
    const showingSelected = selected != null && query === labelOf(selected);
    if (!q || showingSelected) {
      const first = indexed.filter(({ d }) => d.provincia === DEFAULT_PROVINCE);
      const rest = indexed.filter(({ d }) => d.provincia !== DEFAULT_PROVINCE);
      return [...first, ...rest].slice(0, MAX_RESULTS).map(({ d }) => d);
    }
    const starts = indexed.filter(({ key }) => key.startsWith(q));
    const contains = indexed.filter(({ key }) => !key.startsWith(q) && key.includes(q));
    return [...starts, ...contains].slice(0, MAX_RESULTS).map(({ d }) => d);
  }, [indexed, query, selected]);

  const choose = (d: DepartamentoProps) => {
    setQuery(labelOf(d));
    setOpen(false);
    onSelect(d);
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  const expanded = open && !disabled;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!expanded) setOpen(true);
      else setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (expanded && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
        setQuery(selected ? labelOf(selected) : '');
      }
    }
  };

  return (
    <div
      ref={wrapRef}
      className="mapa-combobox"
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery(selected ? labelOf(selected) : '');
        }
      }}
    >
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && results[active] ? optionId(active) : undefined}
        disabled={disabled}
        value={query}
        placeholder={disabled ? 'Cargando departamentos…' : 'Buscá un departamento'}
        className="mapa-combobox__input"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.currentTarget.select();
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {expanded && (
        <ul id={listId} role="listbox" aria-label="Departamentos" className="mapa-combobox__list">
          {results.length === 0 ? (
            <li role="presentation" className="mapa-combobox__empty">Sin resultados</li>
          ) : (
            results.map((d, i) => (
              <li
                key={d.codigo}
                id={optionId(i)}
                role="option"
                aria-selected={selected?.codigo === d.codigo}
                className={`mapa-combobox__option${i === active ? ' mapa-combobox__option--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(d)}
              >
                <span className="mapa-combobox__name">{labelOf(d)}</span>
                {d.provincia && <span className="mapa-combobox__prov">{d.provincia}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
