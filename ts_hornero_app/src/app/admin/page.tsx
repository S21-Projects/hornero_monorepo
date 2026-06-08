import { Add } from "iconsax-reactjs";
import { AdminShell } from "@/components/ui/admin-shell";
import { Button } from "@/components/ui/button";
import PendingOrgsList from "@/components/admin/PendingOrgsList";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <AdminShell
      active="Organizaciones"
      title="Validación de organizaciones"
      subtitle="Revisá y aprobá los comedores que se postulan a la plataforma"
      actions={
        <Button variant="primary" style={{ gap: 8 }}>
          <Add size={18} color="#fff" /> Nueva organización
        </Button>
      }
    >
      <PendingOrgsList />
    </AdminShell>
  );
}
