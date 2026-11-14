import { useArticulos } from '../../lib/hooks/useArticulos';
import { masExigente } from '../../lib/categoria';
import { CATEGORIA_ALIMENTO } from '../../lib/domain-ui';
import { Badge } from '../Badge';
import { Text } from '../ui/Typography';

interface ArticuloPickerProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  /** External validation message (e.g. "elegí al menos un artículo"), shown below the list. */
  error?: string | null;
}

/**
 * Multi-select of active articulos grouped by categoría, for the necesidad create/edit flow
 * (feature catalogo-articulos, work unit H, decision 6): the org requests ≥1 articulo (no
 * quantities), and `categoria` is shown as a read-only derived badge (decision 5's
 * `masExigente`, same rule as the donación línea editor) rather than hand-picked.
 */
export function ArticuloPicker({ selectedIds, onChange, error }: ArticuloPickerProps) {
  const { data: articulos = [] } = useArticulos();

  const porId = new Map(articulos.map((a) => [a.id, a]));
  const categoriasSeleccionadas = selectedIds
    .map((id) => porId.get(id)?.categoria)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const categoriaDerivada = masExigente(categoriasSeleccionadas);

  const grupos = new Map<string, typeof articulos>();
  for (const a of articulos) {
    const grupo = grupos.get(a.categoria) ?? [];
    grupo.push(a);
    grupos.set(a.categoria, grupo);
  }

  function toggle(id: number) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  }

  return (
    <div className="chip-picker">
      {[...grupos.entries()].map(([categoria, items]) => (
        <fieldset key={categoria} className="chip-group">
          <legend className="chip-group__label">
            {CATEGORIA_ALIMENTO[categoria]?.label ?? categoria}
          </legend>
          <div className="chip-group__items">
            {items.map((a) => {
              const selected = selectedIds.includes(a.id);
              return (
                <label key={a.id} className={`chip${selected ? ' chip--selected' : ''}`}>
                  <input
                    type="checkbox"
                    className="chip__input"
                    checked={selected}
                    onChange={() => { toggle(a.id); }}
                  />
                  {a.nombre}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {categoriaDerivada && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text variant="caption" color="ink-3">Categoría:</Text>
          <Badge
            tone={CATEGORIA_ALIMENTO[categoriaDerivada]?.tone ?? 'neutral'}
            label={CATEGORIA_ALIMENTO[categoriaDerivada]?.label ?? categoriaDerivada}
          />
        </div>
      )}

      {error && (
        <Text variant="body-sm" color="urgent">{error}</Text>
      )}
    </div>
  );
}
