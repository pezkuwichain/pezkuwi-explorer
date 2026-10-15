import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AccountProvider } from './account/AccountContext';
import Layout from './ui/Layout';
import Home from './screens/Home';
import OpenAccount from './screens/OpenAccount';
import Account from './screens/Account';
import ActivityDetail from './screens/ActivityDetail';
import PaymentStatus from './screens/PaymentStatus';
import Citizenship from './screens/Citizenship';
import Network from './screens/Network';

// Each later screen task adds its own route here.
export default function App() {
  return (
    <BrowserRouter>
      <AccountProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="account/open" element={<OpenAccount />} />
            <Route path="account" element={<Account />} />
            <Route path="account/activity/:id" element={<ActivityDetail />} />
            <Route path="payment" element={<PaymentStatus />} />
            <Route path="citizenship" element={<Citizenship />} />
            <Route path="network" element={<Network />} />
          </Route>
        </Routes>
      </AccountProvider>
    </BrowserRouter>
  );
}
