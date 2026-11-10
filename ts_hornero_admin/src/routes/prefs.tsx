import { PageHeader } from '../components/ui/PageHeader';
import { StatePanel } from '../components/ui/StatePanel';
import { ComingSoonIcon } from '../components/ui/state-icons';

export default function PrefsPage() {
  return (
    <div>
      <PageHeader title="Preferencias" description="Configurá tu cuenta y tus preferencias de uso." />
      <StatePanel
        icon={ComingSoonIcon}
        title="Próximamente"
        subtitle="Pronto vas a poder configurar tu cuenta desde acá."
      />
    </div>
  );
}
