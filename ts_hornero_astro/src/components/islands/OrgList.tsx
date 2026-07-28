import { useState } from 'react';
import { Location } from 'iconsax-reactjs';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Avatar } from '../ui/avatar';
import { EmptyState } from '../ui/empty-state';
import { Text } from '../ui/typography';
import { TIPO_ORGANIZACION_LABELS, TIPO_ORGANIZACION_OPTIONS, type TipoOrganizacion } from '../../lib/tipos-organizacion';
import type { Org } from '../../lib/types';

const FILTER_OPTIONS = [
  { label: 'Todos', value: '' },
  ...TIPO_ORGANIZACION_OPTIONS,
];

function OrgRow({ org }: { org: Org }) {
  return (
    <a href={`/org/${org.slug}`} className="h-full no-underline [color:inherit]">
      <Card className="flex h-full cursor-pointer items-center gap-4 p-4 transition-shadow sm:gap-[18px] sm:px-6 sm:py-[18px]">
        <Avatar name={org.nombre} size={52} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Text variant="title" as="h3">{org.nombre}</Text>
            <Pill variant="cat">{TIPO_ORGANIZACION_LABELS[org.tipo as TipoOrganizacion] ?? org.tipo}</Pill>
            {org.validada && <Pill variant="ok">Validada</Pill>}
          </div>
          <Text
            as="div"
            variant="body-sm"
            color="ink-2"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Location size={14} color="var(--ink-3)" />
            {org.direccion ?? 'Córdoba'}
          </Text>
          {org.descripcion && (
            <Text
              variant="body-sm"
              color="ink-3"
              style={{ marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {org.descripcion}
            </Text>
          )}
        </div>
      </Card>
    </a>
  );
}

interface OrgListProps {
  orgs: Org[];
}

export default function OrgList({ orgs }: OrgListProps) {
  const [activeFilter, setActiveFilter] = useState<string>('');

  const filteredOrgs = orgs.filter(
    (o) => activeFilter === '' || o.tipo === activeFilter,
  );
  const count = filteredOrgs.length;

  return (
    <>
      <div className="mb-5 flex flex-col gap-1 sm:mb-[22px] sm:flex-row sm:items-end sm:justify-between sm:gap-0">
        <div>
          <Text variant="h1">Organizaciones</Text>
          <Text variant="body" color="ink-2" style={{ marginTop: 5 }}>
            {`${count} ${count === 1 ? 'organización validada' : 'organizaciones validadas'} en Córdoba`}
          </Text>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 sm:mb-[22px]">
        {FILTER_OPTIONS.map(({ label, value }) => {
          const isActive = value === activeFilter;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value)}
              className="cursor-pointer border-0 bg-transparent p-0"
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                background: isActive ? 'var(--earth)' : 'var(--card)',
                boxShadow: isActive ? 'none' : 'var(--sh-1)',
              }}
            >
              <Text variant="label" as="span" style={{ color: isActive ? '#fff' : 'var(--ink-2)' }}>{label}</Text>
            </button>
          );
        })}
      </div>

      {count === 0 ? (
        <EmptyState variant="no-comedores" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrgs.map((org) => (
            <OrgRow key={org.id} org={org} />
          ))}
        </div>
      )}
    </>
  );
}
