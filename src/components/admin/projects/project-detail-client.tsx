"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PlusIcon, PencilIcon, TrashIcon } from "@/components/icons"
import {
  setProjectStatus,
  deleteProject,
  createProjectTask,
  updateProjectTask,
  setProjectTaskStatus,
  deleteProjectTask,
  type ProjectListItem,
  type ProjectTaskItem,
  type ProjectErrorCode,
} from "@/app/actions/projects"
import { useI18n } from "@/lib/i18n/provider"

// ============================================================
// PROJECT DETAIL CLIENT (E2-3) — status transitions (pure gates
// in logic.ts, enforced server-side), the task checklist with
// per-task progress, and destructive actions behind confirm
// dialogs. Completion blocked with a clear bilingual message
// while any task is not DONE ("naloge → zaključek").
// ============================================================

export interface ProjectDetailLabels {
  statusLabels: Record<string, string>
  taskStatusLabels: Record<string, string>
  startWork: string
  completeProject: string
  cancelProject: string
  markDone: string
  startTask: string
  overviewSection: string
  tasksSection: string
  startDate: string
  deadlineLabel: string
  budgetLabel: string
  workOrderLabel: string
  workOrderShort: string
  customerLabel: string
  notesLabel: string
  noNotes: string
  progressLabel: string
  progressDone: string
  taskCountOf: string
  deleteProject: string
  deleteProjectConfirm: string
  completionBlocked: string
  noDeadline: string
  overdueBadge: string
  dueSoonBadge: string
  addTask: string
  taskTitleLabel: string
  taskTitlePlaceholder: string
  taskDueDate: string
  taskAssignee: string
  taskAssigneePlaceholder: string
  taskHours: string
  taskNotes: string
  submitTask: string
  saveTask: string
  editTask: string
  deleteTask: string
  noTasks: string
  tasksDoneCount: string
  taskOverdue: string
  cancelEdit: string
  taskDeleted: string
  errorTexts: Record<string, string>
}

interface ProjectDetailClientProps {
  project: ProjectListItem & { notes: string | null }
  tasks: ProjectTaskItem[]
  locale: string
  labels: ProjectDetailLabels
}

const statusColors: Record<string, string> = {
  PLANNING: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  IN_PROGRESS: "bg-primary/10 text-primary-text",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

const taskStatusColors: Record<string, string> = {
  OPEN: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-primary/10 text-primary-text",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sl-SI", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const EMPTY_TASK = {
  title: "",
  dueDate: "",
  assigneeName: "",
  hoursEst: "",
  notes: "",
}

export function ProjectDetailClient({ project, tasks, locale, labels }: ProjectDetailClientProps) {
  const router = useRouter()
  const { locale: i18nLocale } = useI18n()
  const loc = locale || i18nLocale
  const [pending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState(EMPTY_TASK)

  const onError = (code?: ProjectErrorCode) => {
    if (code === "TASKS_OPEN") {
      toast.error(labels.completionBlocked)
      return
    }
    toast.error((code && labels.errorTexts[code]) || labels.errorTexts.GENERIC)
  }

  // ---- Project status -------------------------------------------------
  const transition = (status: string) => {
    startTransition(async () => {
      const result = await setProjectStatus(project.id, status as "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED")
      if (result.ok) router.refresh()
      else onError(result.error)
    })
  }

  const removeProject = () => {
    startTransition(async () => {
      const result = await deleteProject(project.id)
      if (result.ok) {
        toast.success(labels.deleteProject)
        router.push("/dashboard/projects")
      } else {
        onError(result.error)
      }
    })
  }

  // ---- Tasks ----------------------------------------------------------
  const openTaskDialog = (task?: ProjectTaskItem) => {
    if (task) {
      setEditingTaskId(task.id)
      setTaskForm({
        title: task.title,
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
        assigneeName: task.assigneeName ?? "",
        hoursEst: task.hoursEst === null ? "" : String(task.hoursEst),
        notes: task.notes ?? "",
      })
    } else {
      setEditingTaskId(null)
      setTaskForm(EMPTY_TASK)
    }
    setTaskDialogOpen(true)
  }

  const submitTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskForm.title.trim()) {
      toast.error(labels.taskTitleLabel)
      return
    }
    startTransition(async () => {
      const payload = {
        title: taskForm.title,
        dueDate: taskForm.dueDate || null,
        assigneeName: taskForm.assigneeName || null,
        hoursEst: taskForm.hoursEst ? Number(taskForm.hoursEst) : null,
        notes: taskForm.notes || null,
      }
      const result = editingTaskId
        ? await updateProjectTask(editingTaskId, payload)
        : await createProjectTask(project.id, payload)
      if (result.ok) {
        toast.success(editingTaskId ? labels.saveTask : labels.submitTask)
        setTaskDialogOpen(false)
        setTaskForm(EMPTY_TASK)
        setEditingTaskId(null)
        router.refresh()
      } else {
        onError(result.error)
      }
    })
  }

  const taskTransition = (taskId: string, status: string) => {
    startTransition(async () => {
      const result = await setProjectTaskStatus(taskId, status as "OPEN" | "IN_PROGRESS" | "DONE")
      if (result.ok) router.refresh()
      else onError(result.error)
    })
  }

  const removeTask = (taskId: string) => {
    startTransition(async () => {
      const result = await deleteProjectTask(taskId)
      if (result.ok) {
        toast.success(labels.taskDeleted)
        router.refresh()
      } else {
        onError(result.error)
      }
    })
  }

  // ---- Render ----------------------------------------------------------
  const isLive = project.status === "PLANNING" || project.status === "IN_PROGRESS"
  const budgetText =
    project.budget === null
      ? "—"
      : new Intl.NumberFormat(loc === "en" ? "en-GB" : "sl-SI", {
          style: "currency",
          currency: "EUR",
        }).format(project.budget)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
            <Badge className={`${statusColors[project.status] ?? "bg-muted"} border-transparent`}>
              {labels.statusLabels[project.status] ?? project.status}
            </Badge>
            {project.deadlineState === "OVERDUE" && (
              <Badge variant="destructive">{labels.overdueBadge}</Badge>
            )}
            {project.deadlineState === "DUE_SOON" && (
              <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {labels.dueSoonBadge}
              </Badge>
            )}
          </div>
        </div>

        {/* Status actions — transition gates live in logic.ts (pure) and the action (server) */}
        <div className="flex flex-wrap items-center gap-2">
          {project.status === "PLANNING" && (
            <Button size="sm" onClick={() => transition("IN_PROGRESS")} disabled={pending}>
              {labels.startWork}
            </Button>
          )}
          {project.status === "IN_PROGRESS" && (
            <Button size="sm" onClick={() => transition("COMPLETED")} disabled={pending}>
              {labels.completeProject}
            </Button>
          )}
          {isLive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => transition("CANCELLED")}
              disabled={pending}
            >
              {labels.cancelProject}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={pending}
          >
            <TrashIcon size={14} className="mr-1" />
            {labels.deleteProject}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{labels.overviewSection}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {labels.customerLabel}
                </dt>
                <dd className="text-sm font-medium">{project.customerName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {labels.deadlineLabel}
                </dt>
                <dd className="text-sm font-medium">
                  {project.deadline ? formatDate(project.deadline, loc) : labels.noDeadline}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {labels.startDate}
                </dt>
                <dd className="text-sm font-medium">
                  {project.startDate ? formatDate(project.startDate, loc) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {labels.budgetLabel}
                </dt>
                <dd className="text-sm font-medium">{budgetText}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {labels.workOrderLabel}
                </dt>
                <dd className="text-sm font-medium">
                  {project.workOrderId && project.workOrderNumber !== null ? (
                    <a
                      href={`/dashboard/work-orders/${project.workOrderId}`}
                      className="text-primary-text hover:underline"
                    >
                      {labels.workOrderShort} #{project.workOrderNumber}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {labels.notesLabel}
                </dt>
                <dd className="text-sm">
                  {project.notes ? (
                    <span className="whitespace-pre-wrap">{project.notes}</span>
                  ) : (
                    <span className="text-muted-foreground">{labels.noNotes}</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.progressLabel}</CardTitle>
            <CardDescription>
              {project.progress.done} {labels.taskCountOf} {project.progress.total}{" "}
              {labels.tasksDoneCount}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted h-3 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${project.progress.pct}%` }}
              />
            </div>
            <p className="text-2xl font-bold tabular-nums">{project.progress.pct}%</p>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400">
                ✓ {project.progress.done}
              </span>
              <span className="text-primary-text">◐ {project.progress.inProgress}</span>
              <span>○ {project.progress.open}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{labels.tasksSection}</CardTitle>
            <CardDescription>
              {project.progress.done}/{project.progress.total} {labels.tasksDoneCount}
            </CardDescription>
          </div>
          {isLive && (
            <Button size="sm" variant="outline" onClick={() => openTaskDialog()} disabled={pending}>
              <PlusIcon size={14} className="mr-1" />
              {labels.addTask}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="text-muted-foreground px-6 py-10 text-center text-sm">
              {labels.noTasks}
            </div>
          ) : (
            <ul className="divide-y">
              {tasks.map((task, idx) => (
                <li key={task.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground w-6 text-xs tabular-nums">
                        {idx + 1}.
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          task.status === "DONE" ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {task.title}
                      </span>
                      <Badge className={`${taskStatusColors[task.status] ?? "bg-muted"} w-fit border-transparent text-xs`}>
                        {labels.taskStatusLabels[task.status] ?? task.status}
                      </Badge>
                      {task.overdue && (
                        <Badge variant="destructive" className="w-fit text-xs">
                          {labels.taskOverdue}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pl-8 text-xs">
                      {task.dueDate && <span>{labels.taskDueDate}: {formatDate(task.dueDate, loc)}</span>}
                      {task.assigneeName && <span>{labels.taskAssignee}: {task.assigneeName}</span>}
                      {task.hoursEst !== null && <span>{labels.taskHours}: {task.hoursEst} h</span>}
                      {task.notes && <span className="italic">{task.notes}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 pl-8 sm:pl-0">
                    {task.status === "OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => taskTransition(task.id, "IN_PROGRESS")}
                        disabled={pending}
                      >
                        {labels.startTask}
                      </Button>
                    )}
                    {task.status !== "DONE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                        onClick={() => taskTransition(task.id, "DONE")}
                        disabled={pending}
                      >
                        {labels.markDone}
                      </Button>
                    )}
                    {task.status === "DONE" && isLive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => taskTransition(task.id, "OPEN")}
                        disabled={pending}
                      >
                        {labels.taskStatusLabels.OPEN}
                      </Button>
                    )}
                    {isLive && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openTaskDialog(task)}
                          disabled={pending}
                          aria-label={labels.editTask}
                        >
                          <PencilIcon size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          onClick={() => removeTask(task.id)}
                          disabled={pending}
                          aria-label={labels.deleteTask}
                        >
                          <TrashIcon size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Delete project confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={labels.deleteProject}
        description={labels.deleteProjectConfirm}
        confirmLabel={labels.deleteProject}
        cancelLabel={labels.cancelProject}
        onConfirm={removeProject}
        variant="destructive"
      />

      {/* Task create/edit dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? labels.editTask : labels.addTask}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">{labels.taskTitleLabel}</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder={labels.taskTitlePlaceholder}
                maxLength={200}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="task-due">{labels.taskDueDate}</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-hours">{labels.taskHours}</Label>
                <Input
                  id="task-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={taskForm.hoursEst}
                  onChange={(e) => setTaskForm({ ...taskForm, hoursEst: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assignee">{labels.taskAssignee}</Label>
              <Input
                id="task-assignee"
                value={taskForm.assigneeName}
                onChange={(e) => setTaskForm({ ...taskForm, assigneeName: e.target.value })}
                placeholder={labels.taskAssigneePlaceholder}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-notes">{labels.taskNotes}</Label>
              <Textarea
                id="task-notes"
                value={taskForm.notes}
                onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                rows={2}
                maxLength={1000}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTaskDialogOpen(false)}
                disabled={pending}
              >
                {labels.cancelEdit}
              </Button>
              <Button type="submit" disabled={pending}>
                {editingTaskId ? labels.saveTask : labels.submitTask}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
