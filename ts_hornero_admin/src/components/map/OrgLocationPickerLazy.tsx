import { lazy, Suspense } from 'react';
import type { OrgLocationPickerProps } from './OrgLocationPicker';

// Code-split: Leaflet + react-leaflet are only pulled into the bundle once a
// user reaches an org-creation step (registration or self-service "add org").
const OrgLocationPicker = lazy(() => import('./OrgLocationPicker'));

export function OrgLocationPickerLazy(props: OrgLocationPickerProps) {
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: '100%',
            height: props.height ?? 280,
            background: 'var(--line)',
            borderRadius: 'var(--r-input)',
            ...props.style,
          }}
        />
      }
    >
      <OrgLocationPicker {...props} />
    </Suspense>
  );
}
