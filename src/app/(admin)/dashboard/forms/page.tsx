import { getServerI18n } from "@/lib/i18n/server"
import { listFormDefinitions, listFormSubmissions } from "@/app/actions/forms"
import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { FormsClient } from "@/components/admin/forms/forms-client"
import { requirePagePermission } from "@/lib/auth/guards"

// ============================================================
// FORMS PAGE (EPIC #1 §8 — Phase 4)
// Two surfaces: the tenant's form definitions (materialized
// from its activity profile, owner-toggleable) and the inbox of
// public submissions with the review pipeline + conversion into
// work orders for workflow-capable tenants.
// ============================================================

export default async function FormsPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("inquiries.manage")
  const [{ t }, definitions, submissions] = await Promise.all([
    getServerI18n(),
    listFormDefinitions(),
    listFormSubmissions(),
  ])
  const f = t.workForms.forms
  const canWorkOrders = (await getSessionEffectiveProfile()).capabilities.workOrders !== "disabled"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{f.title}</h1>
        <p className="text-muted-foreground">{f.subtitle}</p>
      </div>

      <FormsClient
        definitions={definitions}
        submissions={submissions}
        canWorkOrders={canWorkOrders}
        editorLabels={f.editor}
        labels={{
          definitions: f.definitions,
          active: f.active,
          inactive: f.inactive,
          submissions: f.submissions,
          submissionsTitle: f.submissionsTitle,
          emptySubmissions: f.emptySubmissions,
          emptySubmissionsHint: f.emptySubmissionsHint,
          contact: f.contact,
          noContact: f.noContact,
          viewData: f.viewData,
          markInReview: f.markInReview,
          markProcessed: f.markProcessed,
          markNew: f.markNew,
          createWorkOrder: f.createWorkOrder,
          createdWorkOrder: f.createdWorkOrder,
          statusLabels: f.statusLabels,
          deactivateConfirm: f.deactivateConfirm,
        }}
      />
    </div>
  )
}
