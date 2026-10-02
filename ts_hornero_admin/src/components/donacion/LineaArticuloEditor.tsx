import { useArticulos } from '../../lib/hooks/useArticulos';
import { masExigente } from '../../lib/categoria';
import { CATEGORIA_ALIMENTO, UNIDAD_ARTICULO } from '../../lib/domain-ui';
import { Badge } from '../Badge';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import type { DonacionLineaInput } from '../../types/domain';

const inputStyle = {
  fontFamily: 'inherit',
  fontSize: 14.5,
  color: 'var(--ink)',
  background: '#fff',
  border: '1.5px solid var(--line)',
  borderRadius: 'var(--r-input)',
  padding: '10px 12px',
  minHeight: 44,
};

interface LineaArticuloEditorProps {
  lineas: DonacionLineaInput[];
  onChange: (lineas: DonacionLineaInput[]) => void;
  /** When provided, the articulo picker only offers these ids (e.g. a necesidad's requested
   * articulos for the DIRECTA flow). Omitted means every active articulo is selectable. */
  articulosPermitidosIds?: number[];
  /** External validation message (e.g. "agregá al menos un artículo"), shown below the rows. */
  error?: string | null;
}

/**
 * Reusable repeatable line editor for a donación's articulo+cantidad lines (feature
 * catalogo-articulos, work unit G): add/remove rows, pick an active articulo grouped by
 * categoría, enter a cantidad with the articulo's unit shown, and a read-only derived categoría
 * badge (decision 5 — the most demanding of the selected lines' categorias). Used by both
 * `nueva-donacion.tsx` (FONDO_COMUN, unrestricted) and `necesidad-detalle.tsx` (DIRECTA,
 * restricted to the necesidad's requested articulos).
 */
export function LineaArticuloEditor({ lineas, onChange, articulosPermitidosIds, error }: LineaArticuloEditorProps) {
  const { data: articulos = [] } = useArticulos();
  const disponibles = articulosPermitidosIds
    ? articulos.filter((a) => articulosPermitidosIds.includes(a.id))
    : articulos;

  const porId = new Map(articulos.map((a) => [a.id, a]));
  const categoriasSeleccionadas = lineas
    .map((l) => porId.get(l.articuloId)?.categoria)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const categoriaDerivada = masExigente(categoriasSeleccionadas);

  const grupos = new Map<string, typeof disponibles>();
  for (const a of disponibles) {
    const grupo = grupos.get(a.categoria) ?? [];
    grupo.push(a);
    grupos.set(a.categoria, grupo);
  }

  function updateLinea(index: number, next: Partial<DonacionLineaInput>) {
    onChange(lineas.map((l, i) => (i === index ? { ...l, ...next } : l)));
  }

  function removeLinea(index: number) {
    onChange(lineas.filter((_, i) => i !== index));
  }

  function addLinea() {
    onChange([...lineas, { articuloId: 0, cantidad: 1 }]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {lineas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lineas.map((linea, index) => {
            const articulo = porId.get(linea.articuloId);
            return (
              <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  aria-label="Artículo"
                  value={linea.articuloId || ''}
                  onChange={(e) => { updateLinea(index, { articuloId: Number(e.target.value) }); }}
                  style={{ ...inputStyle, flex: '1 1 220px' }}
                >
                  <option value="" disabled>Elegí un artículo…</option>
                  {[...grupos.entries()].map(([categoria, items]) => (
                    <optgroup key={categoria} label={CATEGORIA_ALIMENTO[categoria]?.label ?? categoria}>
                      {items.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <input
                  aria-label="Cantidad"
                  type="number"
                  min={0.01}
                  step="any"
                  value={linea.cantidad}
                  onChange={(e) => { updateLinea(index, { cantidad: Number(e.target.value) }); }}
                  style={{ ...inputStyle, width: 100 }}
                />

                <Text variant="body-sm" color="ink-2">
                  {articulo ? UNIDAD_ARTICULO[articulo.unidad] : ''}
                </Text>

                <Button type="button" variant="ghost" size="sm" onClick={() => { removeLinea(index); }}>
                  Quitar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" size="sm" onClick={addLinea}>
          + Agregar artículo
        </Button>

        {categoriaDerivada && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text variant="caption" color="ink-3">Categoría:</Text>
            <Badge
              tone={CATEGORIA_ALIMENTO[categoriaDerivada]?.tone ?? 'neutral'}
              label={CATEGORIA_ALIMENTO[categoriaDerivada]?.label ?? categoriaDerivada}
            />
          </div>
        )}
      </div>

      {error && (
        <Text variant="body-sm" color="urgent">{error}</Text>
      )}
    </div>
  );
}
