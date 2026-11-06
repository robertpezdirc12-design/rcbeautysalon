import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "@/components/icons"
import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { getProjectDetail } from "@/app/actions/projects"
import { getServerI18n } from "@/lib/i18n/server"
import { ProjectDetailClient } from "@/components/admin/projects/project-detail-client"
import { requirePagePermission } from "@/lib/auth/guards"

// ============================================================
// PROJECT DETAIL PAGE (EPIC #2 E2-3) — one project with its
// task checklist. Same extension gate as the list page; a
// foreign or missing id renders 404 (never another tenant's
// data — the action itself is org-scoped).
// ============================================================

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("workorders.manage")
  const { id } = await params
  const profile = await getSessionEffectiveProfile()
  if (!profile.extensions.includes("projects")) notFound()

  const [{ t, locale }, detail] = await Promise.all([getServerI18n(), getProjectDetail(id)])
  if ("error" in detail) notFound()

  const d = t.projects

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/projects"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeftIcon size={16} />
        {d.backToProjects}
      </Link>

      <ProjectDetailClient
        project={detail.project}
        tasks={detail.tasks}
        locale={locale}
        labels={{
          statusLabels: {
            PLANNING: d.statusPlanning,
            IN_PROGRESS: d.statusInProgress,
            COMPLETED: d.statusCompleted,
            CANCELLED: d.statusCancelled,
          },
          taskStatusLabels: {
            OPEN: d.taskOpen,
            IN_PROGRESS: d.taskInProgress,
            DONE: d.taskDone,
          },
          startWork: d.startWork,
          completeProject: d.completeProject,
          cancelProject: d.cancelProject,
          markDone: d.markDone,
          startTask: d.startTask,
          overviewSection: d.overviewSection,
          tasksSection: d.tasksSection,
          startDate: d.startDate,
          deadlineLabel: d.deadlineLabel,
          budgetLabel: d.budgetLabel,
          workOrderLabel: d.workOrderLabel,
          workOrderShort: d.workOrderShort,
          customerLabel: d.customerLabel,
          notesLabel: d.notesLabel,
          noNotes: d.noNotes,
          progressLabel: d.progressLabel,
          progressDone: d.progressDone,
          taskCountOf: d.taskCountOf,
          deleteProject: d.deleteProject,
          deleteProjectConfirm: d.deleteProjectConfirm,
          completionBlocked: d.completionBlocked,
          noDeadline: d.noDeadline,
          overdueBadge: d.overdueBadge,
          dueSoonBadge: d.dueSoonBadge,
          addTask: d.addTask,
          taskTitleLabel: d.taskTitleLabel,
          taskTitlePlaceholder: d.taskTitlePlaceholder,
          taskDueDate: d.taskDueDate,
          taskAssignee: d.taskAssignee,
          taskAssigneePlaceholder: d.taskAssigneePlaceholder,
          taskHours: d.taskHours,
          taskNotes: d.taskNotes,
          submitTask: d.submitTask,
          saveTask: d.saveTask,
          editTask: d.editTask,
          deleteTask: d.deleteTask,
          noTasks: d.noTasks,
          tasksDoneCount: d.tasksDoneCount,
          taskOverdue: d.taskOverdue,
          cancelEdit: d.cancelEdit,
          taskDeleted: d.taskDeleted,
          errorTexts: {
            VALIDATION: d.errValidation,
            NOT_FOUND: d.errNotFound,
            EXTENSION_OFF: d.errExtensionOff,
            LINK_MISMATCH: d.errLinkMismatch,
            INVALID_TRANSITION: d.errTransition,
            TASKS_OPEN: d.errTasksOpen,
            GENERIC: d.errGeneric,
          },
        }}
      />
    </div>
  )
}
