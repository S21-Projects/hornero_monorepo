import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import './styles/global.css';
import { QueryProvider } from './providers/QueryProvider';
import { AuthInitializer } from './components/AuthInitializer';
import { router } from './app/router';
import { AppErrorFallback } from './app/AppErrorFallback';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <QueryProvider>
        <AuthInitializer>
          <RouterProvider router={router} />
        </AuthInitializer>
      </QueryProvider>
    </ErrorBoundary>
  </StrictMode>,
);
