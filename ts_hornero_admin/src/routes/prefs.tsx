import { StatePanel } from '../components/ui/StatePanel';
import { ComingSoonIcon } from '../components/ui/state-icons';

export default function PrefsPage() {
  return (
    <StatePanel
      icon={ComingSoonIcon}
      title="Preferencias"
      subtitle="Próximamente vas a poder configurar tu cuenta desde acá."
    />
  );
}
