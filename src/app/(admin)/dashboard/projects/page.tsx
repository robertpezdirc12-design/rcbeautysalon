import { notFound } from "next/navigation"
import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { listProjects, getProjectLinkOptions } from "@/app/actions/projects"
import { getServerI18n } from "@/lib/i18n/server"
import { ProjectsClient } from "@/components/admin/projects/projects-client"
import { projectErrorText } from "@/lib/projects/error-text"
import { requirePagePermission } from "@/lib/auth/guards"

// ============================================================
// PROJECTS PAGE (EPIC #2 E2-3) — multi-day jobs with a task
// checklist. Server-side gate: the module renders ONLY for
// profiles that enable the `projects` extension (the nav item
// is hidden by the same rule — this page gate is the real
// boundary for direct URL access).
// ============================================================

export default async function ProjectsPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("workorders.manage")
  const profile = await getSessionEffectiveProfile()
  if (!profile.extensions.includes("projects")) notFound()

  const [{ t }, overview, linkOptions] = await Promise.all([
    getServerI18n(),
    listProjects(),
    getProjectLinkOptions(),
  ])

  const d = t.projects

  if ("error" in overview || "error" in linkOptions) {
    const code =
      ("error" in overview ? overview.error : undefined) ??
      ("error" in linkOptions ? linkOptions.error : undefined) ??
      "GENERIC"
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{d.title}</h1>
          <p className="text-muted-foreground">{projectErrorText(d, code)}</p>
        </div>
      </div>
    )
  }

  const stats = [
    { key: "active", label: d.statsActive, value: overview.stats.active },
    { key: "overdue", label: d.statsOverdue, value: overview.stats.overdue },
    { key: "dueSoon", label: d.statsDueSoon, value: overview.stats.dueSoon },
    { key: "completed", label: d.statsCompleted, value: overview.stats.completedThisMonth },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {d.title}{" "}
          <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
            {d.titleAccent}
          </span>
        </h1>
        <p className="text-muted-foreground">{d.welcome}</p>
      </div>

      <ProjectsClient
        projects={overview.projects}
        stats={stats}
        linkOptions={linkOptions}
        labels={{
          newProject: d.newProject,
          colProject: d.colProject,
          colCustomer: d.colCustomer,
          colDeadline: d.colDeadline,
          colProgress: d.colProgress,
          colStatus: d.colStatus,
          colTasks: d.colTasks,
          noProjects: d.noProjects,
          noProjectsFiltered: d.noProjectsFiltered,
          filterAll: d.filterAll,
          noDeadline: d.noDeadline,
          overdueBadge: d.overdueBadge,
          dueSoonBadge: d.dueSoonBadge,
          statusLabels: {
            PLANNING: d.statusPlanning,
            IN_PROGRESS: d.statusInProgress,
            COMPLETED: d.statusCompleted,
            CANCELLED: d.statusCancelled,
          },
          // Create dialog
          nameLabel: d.nameLabel,
          namePlaceholder: d.namePlaceholder,
          startDate: d.startDate,
          deadlineLabel: d.deadlineLabel,
          budgetLabel: d.budgetLabel,
          budgetPlaceholder: d.budgetPlaceholder,
          customerLabel: d.customerLabel,
          customerPlaceholder: d.customerPlaceholder,
          workOrderLabel: d.workOrderLabel,
          workOrderPlaceholder: d.workOrderPlaceholder,
          notesLabel: d.notesLabel,
          notesPlaceholder: d.notesPlaceholder,
          optionalSection: d.optionalSection,
          submitProject: d.submitProject,
          cancelEdit: d.cancelEdit,
          workOrderShort: d.workOrderShort,
        }}
      />
    </div>
  )
}
