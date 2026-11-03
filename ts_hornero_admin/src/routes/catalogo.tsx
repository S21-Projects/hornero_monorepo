import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import {
  useArticulosAdmin,
  useCrearArticulo,
  useDesactivarArticulo,
  useEditarArticulo,
  useReactivarArticulo,
} from '../lib/hooks/useArticulos';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { mapArticuloError } from '../lib/hooks/mapArticuloError';
import { ACTIVO, CATEGORIA_ALIMENTO, FALLBACK_BADGE, UNIDAD_ARTICULO } from '../lib/domain-ui';
import { CategoriaAlimento, UnidadArticulo } from '../types/domain';
import type { Articulo, ArticuloInput } from '../types/domain';

const selectStyle = {
  fontFamily: 'inherit',
  fontSize: 14.5,
  color: 'var(--ink)',
  background: '#fff',
  border: '1.5px solid var(--line)',
  borderRadius: 'var(--r-input)',
  padding: '12px 14px',
};

interface ArticuloFormProps {
  idPrefix: string;
  initial?: ArticuloInput;
  submitLabel: string;
  isPending: boolean;
  errorMessage?: string;
  onSubmit: (input: ArticuloInput) => void;
  onCancel: () => void;
}

/** Shared create/edit form — kept general so donación línea / necesidad pickers (work units G/H)
 * can reuse `CATEGORIA_ALIMENTO`/`UNIDAD_ARTICULO` the same way, even though they won't reuse this
 * exact form shape. */
function ArticuloForm({ idPrefix, initial, submitLabel, isPending, errorMessage, onSubmit, onCancel }: ArticuloFormProps) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [categoria, setCategoria] = useState<CategoriaAlimento>(initial?.categoria ?? CategoriaAlimento.NO_PERECEDERO);
  const [unidad, setUnidad] = useState<UnidadArticulo>(initial?.unidad ?? UnidadArticulo.UNIDAD);
  const [touched, setTouched] = useState(false);

  const nombreTrim = nombre.trim();
  const isValid = nombreTrim.length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    onSubmit({ nombre: nombreTrim, categoria, unidad });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 200px' }}>
        <Input
          id={`${idPrefix}-nombre`}
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        {touched && !isValid && (
          <Text variant="micro" color="urgent" as="p" style={{ marginTop: 4 }}>
            El nombre es obligatorio.
          </Text>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`${idPrefix}-categoria`} style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }}>
          Categoría
        </label>
        <select
          id={`${idPrefix}-categoria`}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaAlimento)}
          style={selectStyle}
        >
          {Object.entries(CATEGORIA_ALIMENTO).map(([value, cfg]) => (
            <option key={value} value={value}>{cfg.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`${idPrefix}-unidad`} style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }}>
          Unidad
        </label>
        <select
          id={`${idPrefix}-unidad`}
          value={unidad}
          onChange={(e) => setUnidad(e.target.value as UnidadArticulo)}
          style={selectStyle}
        >
          {Object.entries(UNIDAD_ARTICULO).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" size="sm" loading={isPending}>{submitLabel}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>

      {errorMessage && (
        <Text variant="body-sm" color="urgent" as="p" style={{ width: '100%', marginTop: 4 }}>
          {errorMessage}
        </Text>
      )}
    </form>
  );
}

/**
 * `/catalogo` (ADMINISTRADOR) — feature catalogo-articulos, work unit F. Manage the donación/
 * necesidad item catalog: list (filterable by categoría, optionally including deactivated items),
 * create, edit, and deactivate (never a hard delete — decision 3 of the feature doc).
 */
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export default function CatalogoPage() {
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState<'' | CategoriaAlimento>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [creando, setCreando] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);

  // Search, category and "include inactive" are server-side filters; every change goes back to page 0.
  const { data, isLoading, isError, isFetching, refetch } = useArticulosAdmin({
    page,
    size: pageSize,
    q,
    categoria: categoriaFiltro || undefined,
    incluirInactivos: mostrarInactivos,
  });
  usePageClamp(page, setPage, data?.totalPages);
  const crear = useCrearArticulo();
  const editar = useEditarArticulo();
  const desactivar = useDesactivarArticulo();
  const reactivar = useReactivarArticulo();

  // Debounce the typed search into the server `q` param.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQ(search.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  const articulos = data?.content ?? [];

  function handleCrear(input: ArticuloInput) {
    crear.mutate(input, { onSuccess: () => setCreando(false) });
  }

  function handleEditar(id: number, input: ArticuloInput) {
    editar.mutate({ id, input }, { onSuccess: () => setEditingId(null) });
  }

  function handleDesactivarClick(id: number) {
    if (confirmandoId !== id) {
      setConfirmandoId(id);
      return;
    }
    setConfirmandoId(null);
    desactivar.mutate(id);
  }

  const columns: Column<Articulo>[] = [
    { key: 'nombre', header: 'Nombre', render: (a) => <Text variant="body">{a.nombre}</Text> },
    {
      key: 'categoria',
      header: 'Categoría',
      render: (a) => <Badge {...(CATEGORIA_ALIMENTO[a.categoria] ?? FALLBACK_BADGE)} />,
    },
    {
      key: 'unidad',
      header: 'Unidad',
      render: (a) => <Text variant="body-sm" color="ink-3">{UNIDAD_ARTICULO[a.unidad] ?? a.unidad}</Text>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (a) => <Badge {...(ACTIVO[String(a.activo)] ?? FALLBACK_BADGE)} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Catálogo de artículos"
        description="Gestioná los artículos que las donaciones y necesidades pueden usar. Desactivar un artículo no lo elimina: deja de poder elegirse para nuevas donaciones o necesidades, pero las existentes lo siguen mostrando."
      />

      <Card style={{ padding: '20px 24px' }}>
        {creando ? (
          <ArticuloForm
            idPrefix="catalogo-crear"
            submitLabel="Crear artículo"
            isPending={crear.isPending}
            errorMessage={crear.isError ? mapArticuloError(crear.error) : undefined}
            onSubmit={handleCrear}
            onCancel={() => {
              setCreando(false);
              crear.reset();
            }}
          />
        ) : (
          <Button type="button" size="sm" onClick={() => setCreando(true)}>Nuevo artículo</Button>
        )}
      </Card>

      <>
        <div style={{ marginTop: 20 }}>
          <PaginatedTable
            columns={columns}
            rows={articulos}
            rowKey={(a) => a.id}
            page={data ?? { number: 0, size: pageSize, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => { void refetch(); }}
            isFetching={isFetching}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
            search={{ value: search, onChange: setSearch, placeholder: 'Buscar por nombre' }}
            emptyLabel={q || categoriaFiltro ? 'No hay artículos que coincidan' : 'No hay artículos en el catálogo'}
            toolbar={
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }}>Filtrar por categoría</span>
                  <select
                    aria-label="Filtrar por categoría"
                    value={categoriaFiltro}
                    onChange={(e) => {
                      setCategoriaFiltro(e.target.value as '' | CategoriaAlimento);
                      setPage(0);
                    }}
                    style={selectStyle}
                  >
                    <option value="">Todas las categorías</option>
                    {Object.entries(CATEGORIA_ALIMENTO).map(([value, cfg]) => (
                      <option key={value} value={value}>{cfg.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={mostrarInactivos}
                    onChange={(e) => {
                      setMostrarInactivos(e.target.checked);
                      setPage(0);
                    }}
                  />
                  <Text variant="body-sm">Mostrar inactivos</Text>
                </label>
              </>
            }
            expandedKeys={editingId != null ? new Set([editingId]) : undefined}
            renderRowDetail={(a) =>
              editingId === a.id ? (
                <ArticuloForm
                  idPrefix={`catalogo-editar-${a.id}`}
                  initial={{ nombre: a.nombre, categoria: a.categoria, unidad: a.unidad }}
                  submitLabel="Guardar cambios"
                  isPending={editar.isPending && editar.variables?.id === a.id}
                  errorMessage={
                    editar.isError && editar.variables?.id === a.id ? mapArticuloError(editar.error) : undefined
                  }
                  onSubmit={(input) => handleEditar(a.id, input)}
                  onCancel={() => {
                    setEditingId(null);
                    editar.reset();
                  }}
                />
              ) : null
            }
            rowActions={(a) =>
              a.activo ? (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingId(editingId === a.id ? null : a.id)}
                  >
                    {editingId === a.id ? 'Cerrar' : 'Editar'}
                  </Button>
                  {confirmandoId === a.id ? (
                    <>
                      <Button type="button" variant="danger" size="sm" onClick={() => handleDesactivarClick(a.id)}>
                        Confirmar
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmandoId(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={desactivar.isPending && desactivar.variables === a.id}
                      onClick={() => handleDesactivarClick(a.id)}
                    >
                      Desactivar
                    </Button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={reactivar.isPending && reactivar.variables === a.id}
                    onClick={() => reactivar.mutate(a.id)}
                  >
                    Reactivar
                  </Button>
                </div>
              )
            }
          />
        </div>
      </>
    </div>
  );
}
