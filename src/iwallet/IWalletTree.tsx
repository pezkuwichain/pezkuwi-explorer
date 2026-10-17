import { Route, Routes } from 'react-router-dom';
import IWalletShell, { IWalletIndex } from './IWalletRoutes';
import Create from './screens/Create';
import Import from './screens/Import';
import Receive from './screens/Receive';
import Send from './screens/Send';
import Settings from './screens/Settings';
import Citizen from './screens/Citizen';

// Everything under /i-wallet (App.tsx mounts it at "i-wallet/*"). It is one module so the whole wallet, with the
// keyring, the crypto code, QR and Face ID, loads as one chunk on first visit and moving between its screens never
// waits again; the explorer's own screens never download it.
export default function IWalletTree() {
  return (
    <Routes>
      <Route element={<IWalletShell />}>
        <Route index element={<IWalletIndex />} />
        <Route path="create" element={<Create />} />
        <Route path="import" element={<Import />} />
        <Route path="receive" element={<Receive />} />
        <Route path="send" element={<Send />} />
        <Route path="settings" element={<Settings />} />
        <Route path="citizen" element={<Citizen />} />
      </Route>
    </Routes>
  );
}
