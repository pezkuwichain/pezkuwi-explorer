import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AccountProvider } from './account/AccountContext';
import { WalletModalHost } from './account/WalletModal';
import Layout from './ui/Layout';
import Home from './screens/Home';
import OpenAccount from './screens/OpenAccount';
import Account from './screens/Account';
import ActivityDetail from './screens/ActivityDetail';
import PaymentStatus from './screens/PaymentStatus';
import Citizenship from './screens/Citizenship';
import Network from './screens/Network';
import { IWalletProvider } from './iwallet/IWalletContext';
import IWalletShell, { IWalletIndex } from './iwallet/IWalletRoutes';
import Create from './iwallet/screens/Create';
import Import from './iwallet/screens/Import';
import Receive from './iwallet/screens/Receive';
import Send from './iwallet/screens/Send';
import Settings from './iwallet/screens/Settings';

// Each later screen task adds its own route here.
export default function App() {
  return (
    <BrowserRouter>
      <AccountProvider>
        <IWalletProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="account/open" element={<OpenAccount />} />
              <Route path="account" element={<Account />} />
              <Route path="account/activity/:id" element={<ActivityDetail />} />
              <Route path="payment" element={<PaymentStatus />} />
              <Route path="citizenship" element={<Citizenship />} />
              <Route path="network" element={<Network />} />
              <Route path="i-wallet" element={<IWalletShell />}>
                <Route index element={<IWalletIndex />} />
                <Route path="create" element={<Create />} />
                <Route path="import" element={<Import />} />
                <Route path="receive" element={<Receive />} />
                <Route path="send" element={<Send />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </IWalletProvider>
        {/* The wallet dialog, opened from Home, /account/open and the address chips. */}
        <WalletModalHost />
      </AccountProvider>
    </BrowserRouter>
  );
}
