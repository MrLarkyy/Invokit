import { useEffect } from 'react';
import { Shell } from './components/Shell';
import { ToastProvider } from './components/Toast';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { InvoiceEditor } from './pages/InvoiceEditor';
import { InvoiceList } from './pages/InvoiceList';
import { Landing } from './pages/Landing';
import { Settings } from './pages/Settings';
import { startRoute, useHashRoute, type Route } from './router';
import { StoreProvider, useStore } from './StoreProvider';

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'uvod':
      return <Landing />;
    case 'faktury':
      return <InvoiceList />;
    case 'nova':
      return <InvoiceEditor key="nova" />;
    case 'upravit':
      return <InvoiceEditor key={route.id} editId={route.id} />;
    case 'faktura':
      return <InvoiceDetail id={route.id} />;
    case 'nastaveni':
      return <Settings />;
  }
}

function Routed() {
  const { data } = useStore();
  const route = useHashRoute() ?? startRoute(data);
  const routeKey = 'id' in route ? `${route.name}-${route.id}` : route.name;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [routeKey]);

  return (
    <Shell route={route}>
      <Page route={route} />
    </Shell>
  );
}

export function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <Routed />
      </StoreProvider>
    </ToastProvider>
  );
}
