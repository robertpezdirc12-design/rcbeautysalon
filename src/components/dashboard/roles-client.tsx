"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { LockIcon, TrashIcon, SpinnerIcon } from "@/components/icons"
import {
  PERMISSION_GROUPS,
  type PermissionKey,
} from "@/lib/permissions/roles"
import {
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  assignCustomRole,
} from "@/app/actions/custom-roles"

export interface RoleRow {
  id: string
  name: string
  description: string | null
  permissions: string[]
  userCount: number
}

export interface MemberRow {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "STAFF"
  customRoleId: string | null
}

const NO_ROLE = "__none__"

export function RolesClient({
  roles,
  members,
}: {
  roles: RoleRow[]
  members: MemberRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Role editor dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null)
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)

  const openCreate = () => {
    setEditingId(null)
    setName("")
    setDescription("")
    setSelected(new Set())
    setDialogOpen(true)
  }

  const openEdit = (role: RoleRow) => {
    setEditingId(role.id)
    setName(role.name)
    setDescription(role.description ?? "")
    setSelected(new Set(role.permissions))
    setDialogOpen(true)
  }

  const togglePermission = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleGroup = (keys: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = keys.every((key) => next.has(key))
      keys.forEach((key) => {
        if (allSelected) {
          next.delete(key)
        } else {
          next.add(key)
        }
      })
      return next
    })
  }

  const saveRole = async () => {
    if (!name.trim()) {
      toast.error("Vnesite ime vloge.")
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        permissions: Array.from(selected) as PermissionKey[],
      }
      const result = editingId
        ? await updateCustomRole(editingId, payload)
        : await createCustomRole(payload)

      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        editingId ? "Vloga je posodobljena." : "Vloga je ustvarjena."
      )
      setDialogOpen(false)
      startTransition(() => router.refresh())
    } catch {
      toast.error("Shranjevanje ni uspelo. Poskusite znova.")
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      const result = await deleteCustomRole(deleteTarget.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        `Vloga „${deleteTarget.name}“ je izbrisana — člani so vrnjeni na privzeti dostop.`
      )
      setDeleteTarget(null)
      startTransition(() => router.refresh())
    } catch {
      toast.error("Brisanje ni uspelo.")
    }
  }

  const handleAssign = async (memberId: string, roleId: string | null) => {
    setPendingMemberId(memberId)
    try {
      const result = await assignCustomRole(memberId, roleId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        roleId
          ? "Vloga po meri je dodeljena — velja takoj."
          : "Vloga po meri je odstranjena — član ima spet privzeti dostop."
      )
      startTransition(() => router.refresh())
    } catch {
      toast.error("Dodelitev ni uspela.")
    } finally {
      setPendingMemberId(null)
    }
  }

  const busy = isSaving || isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Vloge po meri
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Določite, kaj vidijo in urejajo posamezni člani salona.
          </p>
        </div>
        <Button onClick={openCreate} disabled={busy} className="shrink-0">
          <LockIcon size={16} className="mr-2" />
          Nova vloga
        </Button>
      </div>

      {/* Behaviour banner */}
      <div className="bg-muted/50 border-muted text-muted-foreground rounded-lg border px-4 py-3 text-sm">
        Člani <strong>brez</strong> vloge po meri imajo nespremenjen dostop
        (admin — vse; osebje — kot doslej). Vloga po meri dostop{" "}
        <strong>omeji</strong> na izbrana dovoljenja in velja takoj.
      </div>

      {/* Roles grid */}
      {roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <LockIcon size={32} className="text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Še ni vloge po meri. Ustvari prvo — npr. „Admin brez financ“ ali
              „Senior frizer“.
            </p>
            <Button variant="outline" onClick={openCreate} disabled={busy}>
              Nova vloga
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LockIcon size={15} className="text-primary-text shrink-0" />
                    <span className="truncate">{role.name}</span>
                  </CardTitle>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => openEdit(role)}
                      disabled={busy}
                    >
                      Uredi
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 px-2"
                      onClick={() => setDeleteTarget(role)}
                      disabled={busy}
                      aria-label={`Izbriši vlogo ${role.name}`}
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>
                </div>
                {role.description && (
                  <CardDescription className="line-clamp-2 text-xs">
                    {role.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto flex items-center gap-2 pt-0">
                <Badge variant="secondary">
                  {role.permissions.length}{" "}
                  {role.permissions.length === 1
                    ? "dovoljenje"
                    : role.permissions.length === 2
                      ? "dovoljenji"
                      : "dovoljenj"}
                </Badge>
                <Badge variant="outline">
                  {role.userCount}{" "}
                  {role.userCount === 1 ? "član" : role.userCount === 2 ? "člana" : "članov"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Members + assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Člani salona</CardTitle>
          <CardDescription>
            Dodelite vlogo po meri posameznemu članu — velja takoj, brez
            ponovne prijave.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Ni članov z dostopom do nadzorne plošče.
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="border-border/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.name || "Brez imena"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {member.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={member.role === "ADMIN" ? "default" : "secondary"}>
                    {member.role === "ADMIN" ? "Admin" : "Osebje"}
                  </Badge>
                  <Select
                    value={member.customRoleId ?? NO_ROLE}
                    onValueChange={(value) =>
                      handleAssign(
                        member.id,
                        value === NO_ROLE ? null : value
                      )
                    }
                    disabled={busy || pendingMemberId === member.id}
                  >
                    <SelectTrigger className="w-[200px]" aria-label={`Vloga za ${member.email}`}>
                      {pendingMemberId === member.id ? (
                        <SpinnerIcon size={14} className="animate-spin" />
                      ) : (
                        <SelectValue placeholder="Izberite vlogo" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ROLE}>— Brez vloge po meri —</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Uredi vlogo" : "Nova vloga po meri"}
            </DialogTitle>
            <DialogDescription>
              Izberite dovoljenja, ki jih člani s to vlogo dobijo. Vse ostalo
              je skrito (navigacija) in zavrnjeno (strežnik).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Ime vloge</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="npr. Admin brez financ"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description">Opis (neobvezno)</Label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Za kaj je ta vloga namenjena?"
                rows={2}
                maxLength={280}
              />
            </div>

            <div className="space-y-3">
              <Label>Dovoljenja</Label>
              {PERMISSION_GROUPS.map((group) => {
                const groupKeys = group.permissions.map((p) => p.key)
                const allSelected = groupKeys.every((key) => selected.has(key))
                return (
                  <div
                    key={group.id}
                    className="border-border/60 rounded-lg border p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">{group.label}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => toggleGroup(groupKeys)}
                      >
                        {allSelected ? "Počisti vse" : "Izberi vse"}
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission.key}
                          className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm"
                        >
                          <Checkbox
                            checked={selected.has(permission.key)}
                            onCheckedChange={() =>
                              togglePermission(permission.key)
                            }
                            aria-label={permission.label}
                          />
                          {permission.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              Prekliči
            </Button>
            <Button onClick={saveRole} disabled={busy}>
              {isSaving && <SpinnerIcon size={14} className="mr-2 animate-spin" />}
              {editingId ? "Shrani spremembe" : "Ustvari vlogo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Izbriši vlogo „${deleteTarget?.name ?? ""}“?`}
        description="Člani s to vlogo takoj prevzamejo privzeti dostop (admin — vse, osebje — kot doslej). Tega ni mogoče razveljaviti."
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
