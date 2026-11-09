import { IdentityGate } from './components/IdentityGate';
import { Dashboard } from './pages/Dashboard';

export function App() {
  return (
    <IdentityGate>
      {(identity, signOut) => <Dashboard identity={identity} onSignOut={signOut} />}
    </IdentityGate>
  );
}
