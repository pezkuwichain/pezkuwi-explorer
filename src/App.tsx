import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AccountProvider } from './account/AccountContext';
import Layout from './ui/Layout';
import Home from './screens/Home';
import OpenAccount from './screens/OpenAccount';

// Each later screen task adds its own route here.
export default function App() {
  return (
    <BrowserRouter>
      <AccountProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="account/open" element={<OpenAccount />} />
          </Route>
        </Routes>
      </AccountProvider>
    </BrowserRouter>
  );
}
