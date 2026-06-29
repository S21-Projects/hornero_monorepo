import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './styles/global.css';
import { QueryProvider } from './providers/QueryProvider';
import { AuthInitializer } from './components/AuthInitializer';
import { router } from './app/router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <AuthInitializer>
        <RouterProvider router={router} />
      </AuthInitializer>
    </QueryProvider>
  </StrictMode>,
);
