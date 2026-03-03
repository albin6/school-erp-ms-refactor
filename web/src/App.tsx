import { ConfigProvider, App as AntApp } from 'antd';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { isSuperAdminDomain, isRootDomain } from './utils/subdomain';

import { LandingRouter } from './router/LandingRouter';
import { SuperAdminRouter } from './router/SuperAdminRouter';
import { TenantRouter } from './router/TenantRouter';
import { TenantContextGuard } from './modules/tenant/components/guard/TenantContextGuard';

const App = () => {

  const getRouter = () => {
    if (isRootDomain()) {
      return <LandingRouter />;
    } else if (isSuperAdminDomain()) {
      return <SuperAdminRouter />;
    } else {
      return (
        <TenantContextGuard>
          <TenantRouter />
        </TenantContextGuard>
      );
    }
  };

  return (
    <ErrorBoundary>
      <ConfigProvider theme={{ token: { colorPrimary: '#00b96b' } }}>
        <AntApp>
          {getRouter()}
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
};

export default App;
