"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import {
  canTransitionProject,
  canTransitionTask,
  projectCompletionBlock,
  computeProgress,
  deadlineState,
  PROJECT_STATUSES,
  PROJECT_TASK_STATUSES,
  type ProjectStatusValue,
  type ProjectTaskStatusValue,
  type ProjectProgress,
  type DeadlineState,
} from "@/lib/projects/logic"

// ============================================================
// PROJECTS & TASKS ACTIONS (EPIC #2 E2-3).
// Runtime for the `projects` extension — multi-day jobs with a
// task checklist. Every action is strictly org-scoped via
// requirePermissionOrg; optional customer/work-order links must
// belong to the SAME tenant (the client can never inject
// foreign ids). Every action re-checks that the effective
// profile actually enables the `projects` extension — hiding
// the nav item is UX, this gate is the security boundary
// ("profili brez zmožnosti ne vidijo modula", enforced, not
// cosmetic). Status transitions and the completion rule are
// the pure gates in src/lib/projects/logic.ts.
// ============================================================

/** Date-only input ("YYYY-MM-DD") → UTC midnight Date, or null. */
function parseDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date")

const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startDate: dateOnly.nullable().optional(),
  deadline: dateOnly.nullable().optional(),
  budget: z.number().min(0).max(10_000_000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  customerId: z.string().min(1).max(64).nullable().optional(),
  workOrderId: z.string().min(1).max(64).nullable().optional(),
})

const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueDate: dateOnly.nullable().optional(),
  assigneeName: z.string().trim().max(80).nullable().optional(),
  hoursEst: z.number().min(0).max(1000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export type ProjectInput = z.input<typeof projectInputSchema>
export type TaskInput = z.input<typeof taskInputSchema>

/** Error codes the UI maps to bilingual text. */
export type ProjectErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "EXTENSION_OFF"
  | "LINK_MISMATCH"
  | "INVALID_TRANSITION"
  | "TASKS_OPEN"
  | "GENERIC"

export interface ProjectResult {
  ok: boolean
  error?: ProjectErrorCode
  id?: string
}

// ------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------

/** THE module gate — effective profile must enable `projects`. */
async function requireProjectsEnabled(): Promise<boolean> {
  const profile = await getSessionEffectiveProfile()
  return profile.extensions.includes("projects")
}

/** Validate optional same-org links; null clears the link. */
async function resolveLinks(
  orgId: string,
  input: { customerId?: string | null; workOrderId?: string | null }
): Promise<{ ok: true; customerId: string | null; workOrderId: string | null } | { ok: false }> {
  let customerId: string | null = null
  let workOrderId: string | null = null

  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: orgId },
      select: { id: true },
    })
    if (!customer) return { ok: false }
    customerId = customer.id
  }
  if (input.workOrderId) {
    const wo = await prisma.workOrder.findFirst({
      where: { id: input.workOrderId, organizationId: orgId },
      select: { id: true },
    })
    if (!wo) return { ok: false }
    workOrderId = wo.id
  }
  return { ok: true, customerId, workOrderId }
}

// ------------------------------------------------------------
// Read models (UI DTOs)
// ------------------------------------------------------------

export interface ProjectTaskItem {
  id: string
  title: string
  status: ProjectTaskStatusValue
  dueDate: string | null
  assigneeName: string | null
  hoursEst: number | null
  notes: string | null
  position: number
  /** Overdue = due in the past and not DONE. */
  overdue: boolean
}

export interface ProjectListItem {
  id: string
  name: string
  status: ProjectStatusValue
  startDate: string | null
  deadline: string | null
  budget: number | null
  customerId: string | null
  customerName: string | null
  workOrderId: string | null
  workOrderNumber: number | null
  progress: ProjectProgress
  deadlineState: DeadlineState
  taskCount: number
  updatedAt: string
}

export interface ProjectsOverview {
  stats: {
    active: number
    overdue: number
    dueSoon: number
    completedThisMonth: number
  }
  projects: ProjectListItem[]
}

function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString() : null
}

function toListItem(
  p: PrismaProjectWithTasks,
  now: Date
): ProjectListItem {
  const progress = computeProgress(p.tasks.map((t) => ({ status: t.status as ProjectTaskStatusValue })))
  return {
    id: p.id,
    name: p.name,
    status: p.status as ProjectStatusValue,
    startDate: toDateStr(p.startDate),
    deadline: toDateStr(p.deadline),
    budget: p.budget === null ? null : Number(p.budget),
    customerId: p.customerId,
    customerName: p.customer?.name ?? null,
    workOrderId: p.workOrderId,
    workOrderNumber: p.workOrder?.number ?? null,
    progress,
    deadlineState: deadlineState(p.deadline, p.status as ProjectStatusValue, now),
    taskCount: p.tasks.length,
    updatedAt: p.updatedAt.toISOString(),
  }
}

type PrismaProjectWithTasks = {
  id: string
  name: string
  status: string
  startDate: Date | null
  deadline: Date | null
  budget: unknown
  notes: string | null
  customerId: string | null
  workOrderId: string | null
  updatedAt: Date
  customer?: { name: string } | null
  workOrder?: { number: number } | null
  tasks: { status: string }[]
}

const PROJECT_INCLUDE = {
  customer: { select: { name: true } },
  workOrder: { select: { number: true } },
  tasks: { select: { status: true } },
} as const

/** All projects of the tenant, active first, then by nearest deadline. */
export async function listProjects(): Promise<ProjectsOverview | { error: ProjectErrorCode }> {
  if (!(await requireProjectsEnabled())) return { error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const now = new Date()
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )

  const [projects, completedThisMonth] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: org.id },
      include: PROJECT_INCLUDE,
      orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
    }),
    prisma.project.count({
      where: {
        organizationId: org.id,
        status: "COMPLETED",
        updatedAt: { gte: monthStart },
      },
    }),
  ])

  const items = projects.map((p) => toListItem(p as PrismaProjectWithTasks, now))
  const active = items.filter((p) => p.status === "PLANNING" || p.status === "IN_PROGRESS")

  return {
    stats: {
      active: active.length,
      overdue: active.filter((p) => p.deadlineState === "OVERDUE").length,
      dueSoon: active.filter((p) => p.deadlineState === "DUE_SOON").length,
      completedThisMonth,
    },
    projects: items,
  }
}

export interface ProjectDetail {
  project: ProjectListItem & { notes: string | null }
  tasks: ProjectTaskItem[]
}

/** One project with its full task checklist (org-scoped). */
export async function getProjectDetail(
  id: string
): Promise<ProjectDetail | { error: ProjectErrorCode }> {
  if (!(await requireProjectsEnabled())) return { error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const project = await prisma.project.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: { select: { name: true } },
      workOrder: { select: { number: true } },
      tasks: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  })
  if (!project) return { error: "NOT_FOUND" }

  const now = new Date()
  const base = toListItem(project as PrismaProjectWithTasks, now)

  const tasks: ProjectTaskItem[] = project.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status as ProjectTaskStatusValue,
    dueDate: toDateStr(t.dueDate),
    assigneeName: t.assigneeName,
    hoursEst: t.hoursEst === null ? null : Number(t.hoursEst),
    notes: t.notes,
    position: t.position,
    overdue:
      t.status !== "DONE" &&
      deadlineState(t.dueDate, "IN_PROGRESS", now) === "OVERDUE",
  }))

  return { project: { ...base, notes: project.notes }, tasks }
}

/** Select options for the create/edit form (same-org only). */
export interface ProjectLinkOptions {
  customers: { id: string; name: string }[]
  workOrders: { id: string; number: number; title: string }[]
}

export async function getProjectLinkOptions(): Promise<
  ProjectLinkOptions | { error: ProjectErrorCode }
> {
  if (!(await requireProjectsEnabled())) return { error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const [customers, workOrders] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.workOrder.findMany({
      where: { organizationId: org.id },
      select: { id: true, number: true, title: true },
      orderBy: { number: "desc" },
      take: 100,
    }),
  ])

  return { customers, workOrders }
}

// ------------------------------------------------------------
// Project mutations
// ------------------------------------------------------------

export async function createProject(input: ProjectInput): Promise<ProjectResult> {
  const parsed = projectInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  if (!(await requireProjectsEnabled())) return { ok: false, error: "EXTENSION_OFF" }
  const { org, session } = await requirePermissionOrg("workorders.manage")

  const links = await resolveLinks(org.id, parsed.data)
  if (!links.ok) return { ok: false, error: "LINK_MISMATCH" }

  const created = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: parsed.data.name,
      startDate: parseDateOrNull(parsed.data.startDate),
      deadline: parseDateOrNull(parsed.data.deadline),
      budget: parsed.data.budget ?? null,
      notes: parsed.data.notes?.trim() || null,
      customerId: links.customerId,
      workOrderId: links.workOrderId,
      createdById: session.user.id || null,
    },
    select: { id: true },
  })

  revalidatePath("/dashboard/projects")
  revalidatePath("/dashboard")
  return { ok: true, id: created.id }
}

export async function updateProject(id: string, input: ProjectInput): Promise<ProjectResult> {
  const parsed = projectInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  if (!(await requireProjectsEnabled())) return { ok: false, error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const existing = await prisma.project.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  const links = await resolveLinks(org.id, parsed.data)
  if (!links.ok) return { ok: false, error: "LINK_MISMATCH" }

  await prisma.project.update({
    where: { id },
    data: {
      name: parsed.data.name,
      startDate: parseDateOrNull(parsed.data.startDate),
      deadline: parseDateOrNull(parsed.data.deadline),
      budget: parsed.data.budget ?? null,
      notes: parsed.data.notes?.trim() || null,
      customerId: links.customerId,
      workOrderId: links.workOrderId,
    },
  })

  revalidatePath("/dashboard/projects")
  revalidatePath(`/dashboard/projects/${id}`)
  revalidatePath("/dashboard")
  return { ok: true, id }
}

export async function setProjectStatus(
  id: string,
  status: ProjectStatusValue
): Promise<ProjectResult> {
  if (!PROJECT_STATUSES.includes(status)) return { ok: false, error: "VALIDATION" }
  if (!(await requireProjectsEnabled())) return { ok: false, error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const project = await prisma.project.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, status: true },
  })
  if (!project) return { ok: false, error: "NOT_FOUND" }

  // Pure gate 1 — the transition itself (PLANNING → IN_PROGRESS → COMPLETED).
  if (!canTransitionProject(project.status as ProjectStatusValue, status)) {
    return { ok: false, error: "INVALID_TRANSITION" }
  }

  // Pure gate 2 — THE acceptance rule: completion requires every
  // task DONE ("projekt ustvarjen → naloge → zaključek").
  if (status === "COMPLETED") {
    const tasks = await prisma.projectTask.findMany({
      where: { projectId: id, organizationId: org.id },
      select: { status: true },
    })
    if (projectCompletionBlock(tasks.map((t) => ({ status: t.status as ProjectTaskStatusValue })))) {
      return { ok: false, error: "TASKS_OPEN" }
    }
  }

  await prisma.project.update({ where: { id }, data: { status } })

  revalidatePath("/dashboard/projects")
  revalidatePath(`/dashboard/projects/${id}`)
  revalidatePath("/dashboard")
  return { ok: true, id }
}

export async function deleteProject(id: string): Promise<ProjectResult> {
  if (!(await requireProjectsEnabled())) return { ok: false, error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const existing = await prisma.project.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  // Tasks cascade (schema onDelete: Cascade) — one delete, no orphans.
  await prisma.project.delete({ where: { id } })

  revalidatePath("/dashboard/projects")
  revalidatePath("/dashboard")
  return { ok: true }
}

// ------------------------------------------------------------
// Task mutations
// ------------------------------------------------------------

export async function createProjectTask(
  projectId: string,
  input: TaskInput
): Promise<ProjectResult> {
  const parsed = taskInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  if (!(await requireProjectsEnabled())) return { ok: false, error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: org.id },
    select: { id: true, status: true },
  })
  if (!project) return { ok: false, error: "NOT_FOUND" }
  if (project.status === "COMPLETED" || project.status === "CANCELLED") {
    return { ok: false, error: "INVALID_TRANSITION" }
  }

  const last = await prisma.projectTask.findFirst({
    where: { projectId, organizationId: org.id },
    orderBy: { position: "desc" },
    select: { position: true },
  })

  await prisma.projectTask.create({
    data: {
      organizationId: org.id,
      projectId,
      title: parsed.data.title,
      dueDate: parseDateOrNull(parsed.data.dueDate),
      assigneeName: parsed.data.assigneeName?.trim() || null,
      hoursEst: parsed.data.hoursEst ?? null,
      notes: parsed.data.notes?.trim() || null,
      position: (last?.position ?? -1) + 1,
    },
  })

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath("/dashboard/projects")
  return { ok: true }
}

export async function updateProjectTask(
  taskId: string,
  input: TaskInput
): Promise<ProjectResult> {
  const parsed = taskInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  if (!(await requireProjectsEnabled())) return { ok: false, error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, organizationId: org.id },
    select: { id: true, projectId: true },
  })
  if (!task) return { ok: false, error: "NOT_FOUND" }

  await prisma.projectTask.update({
    where: { id: taskId },
    data: {
      title: parsed.data.title,
      dueDate: parseDateOrNull(parsed.data.dueDate),
      assigneeName: parsed.data.assigneeName?.trim() || null,
      hoursEst: parsed.data.hoursEst ?? null,
      notes: parsed.data.notes?.trim() || null,
    },
  })

  revalidatePath(`/dashboard/projects/${task.projectId}`)
  revalidatePath("/dashboard/projects")
  return { ok: true }
}

export async function setProjectTaskStatus(
  taskId: string,
  status: ProjectTaskStatusValue
): Promise<ProjectResult> {
  if (!PROJECT_TASK_STATUSES.includes(status)) return { ok: false, error: "VALIDATION" }
  if (!(await requireProjectsEnabled())) return { ok: false, error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, organizationId: org.id },
    select: { id: true, projectId: true, status: true },
  })
  if (!task) return { ok: false, error: "NOT_FOUND" }

  if (!canTransitionTask(task.status as ProjectTaskStatusValue, status)) {
    return { ok: false, error: "INVALID_TRANSITION" }
  }

  await prisma.projectTask.update({ where: { id: taskId }, data: { status } })

  revalidatePath(`/dashboard/projects/${task.projectId}`)
  revalidatePath("/dashboard/projects")
  revalidatePath("/dashboard")
  return { ok: true, id: task.projectId }
}

export async function deleteProjectTask(taskId: string): Promise<ProjectResult> {
  if (!(await requireProjectsEnabled())) return { ok: false, error: "EXTENSION_OFF" }
  const { org } = await requirePermissionOrg("workorders.manage")

  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, organizationId: org.id },
    select: { id: true, projectId: true },
  })
  if (!task) return { ok: false, error: "NOT_FOUND" }

  await prisma.projectTask.delete({ where: { id: taskId } })

  revalidatePath(`/dashboard/projects/${task.projectId}`)
  revalidatePath("/dashboard/projects")
  return { ok: true }
}
