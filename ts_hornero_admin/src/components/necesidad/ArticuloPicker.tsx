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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[...grupos.entries()].map(([categoria, items]) => (
        <fieldset key={categoria} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px' }}>
          <legend>
            <Text variant="caption" color="ink-3">
              {CATEGORIA_ALIMENTO[categoria]?.label ?? categoria}
            </Text>
          </legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((a) => (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(a.id)}
                  onChange={() => { toggle(a.id); }}
                />
                <Text variant="body-sm">{a.nombre}</Text>
              </label>
            ))}
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
