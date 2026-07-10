"use client";

import type { ProjectMembershipsQuery } from "@atlashq/api-client";
import type { ProjectRole } from "@atlashq/types";
import { projectRoles } from "@atlashq/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  RotateCcwIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchProjectMemberships,
  getProjectMembershipsFamilyQueryKey,
  type ProjectMembershipListResponse,
  useAddProjectMembershipMutation,
  useRemoveProjectMembershipMutation,
  useUpdateProjectMembershipMutation,
} from "@/features/api";
import { type OrganizationUserOption, OrganizationUserPicker } from "@/features/organization-users";
import { formatAtlasErrorMessage, formatDateTimeUtc } from "../detail/project-detail-model";
import {
  EDITABLE_MEMBERSHIP_STATUSES,
  getMembershipStatusLabel,
  getProjectRoleDescription,
  type MembershipAddFormValues,
  type MembershipStatus,
  membershipAddFormSchema,
  PROJECT_ROLE_OPTIONS,
} from "./project-membership-model";

const MEMBERSHIP_PAGE_SIZE = 25;
const MISSING_PROJECT_ID = "__missing__";
const MEMBERSHIP_SKELETON_KEYS = [
  "membership-1",
  "membership-2",
  "membership-3",
  "membership-4",
] as const;

type ProjectMembership = ProjectMembershipListResponse["items"][number];

type ProjectMembershipPanelProps = {
  projectId: string;
  canManageMembers: boolean;
  isArchived: boolean;
};

function useProjectMembershipPages(projectId: string) {
  return useInfiniteQuery({
    queryKey: [
      ...getProjectMembershipsFamilyQueryKey(projectId || MISSING_PROJECT_ID),
      "infinite",
      MEMBERSHIP_PAGE_SIZE,
    ],
    enabled: projectId.length > 0,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const filters: ProjectMembershipsQuery = {
        limit: MEMBERSHIP_PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam } : {}),
      };

      return fetchProjectMemberships(projectId, filters, { signal });
    },
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
  });
}

function getMembershipTimeline(membership: ProjectMembership) {
  if (membership.addedAt) {
    return {
      label: "Added",
      value: formatDateTimeUtc(membership.addedAt),
    };
  }

  if (membership.invitedAt) {
    return {
      label: "Invited",
      value: formatDateTimeUtc(membership.invitedAt),
    };
  }

  if (membership.deactivatedAt) {
    return {
      label: "Removed",
      value: formatDateTimeUtc(membership.deactivatedAt),
    };
  }

  return {
    label: "Recorded",
    value: formatDateTimeUtc(membership.createdAt),
  };
}

function MembershipTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-full" />
      {MEMBERSHIP_SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-14 w-full" />
      ))}
    </div>
  );
}

type MembershipRemoveActionProps = {
  membership: ProjectMembership;
  disabled: boolean;
  onConfirm: (membership: ProjectMembership) => Promise<boolean>;
};

function MembershipRemoveAction({ membership, disabled, onConfirm }: MembershipRemoveActionProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} size="sm" variant="outline">
          <Trash2Icon data-icon="inline-start" />
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Remove project membership?</AlertDialogTitle>
          <AlertDialogDescription>
            {membership.user?.name ?? membership.userId} will lose direct access to this project.
            Archived projects stay readable only through their retained audit history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting}
            variant="destructive"
            onClick={async (event) => {
              event.preventDefault();
              setIsSubmitting(true);
              const shouldClose = await onConfirm(membership);
              setIsSubmitting(false);

              if (shouldClose) {
                setOpen(false);
              }
            }}
          >
            {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
            Remove member
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ProjectMembershipPanel({
  projectId,
  canManageMembers,
  isArchived,
}: ProjectMembershipPanelProps) {
  const membershipPagesQuery = useProjectMembershipPages(projectId);
  const addMembershipMutation = useAddProjectMembershipMutation();
  const updateMembershipMutation = useUpdateProjectMembershipMutation();
  const removeMembershipMutation = useRemoveProjectMembershipMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<OrganizationUserOption | null>(null);

  const form = useForm<MembershipAddFormValues>({
    resolver: zodResolver(membershipAddFormSchema),
    defaultValues: {
      userId: "",
      role: projectRoles.developer,
    },
  });

  const selectedRole = form.watch("role");
  const memberships = useMemo(
    () => membershipPagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [membershipPagesQuery.data],
  );
  const memberUserIds = useMemo(
    () => memberships.map((membership) => membership.userId),
    [memberships],
  );
  const totalMembers = membershipPagesQuery.data?.pages[0]?.pageInfo.total ?? memberships.length;
  const controlsDisabled =
    isArchived ||
    !canManageMembers ||
    addMembershipMutation.isPending ||
    updateMembershipMutation.isPending ||
    removeMembershipMutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      await addMembershipMutation.mutateAsync({
        projectId,
        input: values,
      });

      toast.success("Membership added.", {
        description: "The workspace membership list was refreshed.",
      });
      form.reset({ userId: "", role: values.role });
      setSelectedUser(null);
    } catch (error) {
      const description = formatAtlasErrorMessage(
        error,
        "The member could not be added to this project.",
      );
      setFormError(description);
      toast.error("Couldn't add membership.", { description });
    }
  });

  async function updateMembershipRole(membership: ProjectMembership, role: ProjectRole) {
    if (membership.role === role) {
      return;
    }

    try {
      await updateMembershipMutation.mutateAsync({
        projectId,
        membershipId: membership.id,
        input: { role },
      });

      toast.success("Role updated.", {
        description: `${membership.user?.name ?? membership.userId} is now ${role}.`,
      });
    } catch (error) {
      toast.error("Couldn't update role.", {
        description: formatAtlasErrorMessage(error, "Role changes were not saved."),
      });
    }
  }

  async function updateMembershipStatus(membership: ProjectMembership, status: MembershipStatus) {
    if (membership.status === status) {
      return;
    }

    try {
      await updateMembershipMutation.mutateAsync({
        projectId,
        membershipId: membership.id,
        input: { status },
      });

      toast.success("Membership status updated.", {
        description: `${membership.user?.name ?? membership.userId} is now ${getMembershipStatusLabel(
          status,
        ).toLowerCase()}.`,
      });
    } catch (error) {
      toast.error("Couldn't update membership status.", {
        description: formatAtlasErrorMessage(error, "Status changes were not saved."),
      });
    }
  }

  async function removeMembership(membership: ProjectMembership) {
    try {
      await removeMembershipMutation.mutateAsync({
        projectId,
        membershipId: membership.id,
      });

      toast.success("Membership removed.", {
        description: `${membership.user?.name ?? membership.userId} no longer has project access.`,
      });
      return true;
    } catch (error) {
      toast.error("Couldn't remove membership.", {
        description: formatAtlasErrorMessage(error, "The membership could not be removed."),
      });
      return false;
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <UsersIcon />
          Members
        </CardTitle>
        <CardDescription>Roles, status, and membership history for this workspace.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {isArchived ? (
          <Alert>
            <ShieldAlertIcon />
            <AlertTitle>Memberships are frozen while the project is archived.</AlertTitle>
            <AlertDescription>
              Restore the project before adding, updating, or removing members.
            </AlertDescription>
          </Alert>
        ) : !canManageMembers ? (
          <Alert>
            <ShieldAlertIcon />
            <AlertTitle>Memberships are read-only.</AlertTitle>
            <AlertDescription>
              Only organization admins and Project Owners can manage project membership from this
              workspace.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <UserPlusIcon />
            <AlertTitle>Add members from your organization directory.</AlertTitle>
            <AlertDescription>
              Search active organization members by name or email, then choose a project role.
            </AlertDescription>
          </Alert>
        )}

        {canManageMembers && !isArchived ? (
          <form noValidate onSubmit={onSubmit}>
            <FieldGroup>
              {formError ? (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>Membership update failed</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <FieldGroup className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem_auto] lg:items-start lg:gap-4">
                <Field data-invalid={!!form.formState.errors.userId || undefined}>
                  <FieldLabel htmlFor="project-membership-user-id">Member</FieldLabel>
                  <Controller
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <OrganizationUserPicker
                        id="project-membership-user-id"
                        value={selectedUser}
                        onSelect={(user) => {
                          setSelectedUser(user);
                          field.onChange(user.id);
                        }}
                        excludeUserIds={memberUserIds}
                        disabled={controlsDisabled}
                        invalid={!!form.formState.errors.userId}
                        aria-describedby="project-membership-user-id-description"
                      />
                    )}
                  />
                  <FieldDescription id="project-membership-user-id-description">
                    Search active organization members by name or email.
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.userId]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="project-membership-role">Role</FieldLabel>
                  <Controller
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <Select
                        disabled={controlsDisabled}
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="project-membership-role"
                          aria-invalid={!!form.formState.errors.role}
                          className="w-full"
                        >
                          <SelectValue placeholder="Choose a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Project roles</SelectLabel>
                            {PROJECT_ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldDescription>
                    {getProjectRoleDescription(selectedRole ?? projectRoles.developer)}
                  </FieldDescription>
                </Field>

                <Field className="lg:pt-7">
                  <Button disabled={controlsDisabled} type="submit">
                    {addMembershipMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                    Add member
                  </Button>
                </Field>
              </FieldGroup>
            </FieldGroup>
          </form>
        ) : null}

        {membershipPagesQuery.isError && memberships.length === 0 ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Couldn't load project memberships</AlertTitle>
            <AlertDescription className="gap-3">
              <p>
                {formatAtlasErrorMessage(
                  membershipPagesQuery.error,
                  "The membership list could not be loaded.",
                )}
              </p>
              <div>
                <Button
                  variant="outline"
                  onClick={() => {
                    void membershipPagesQuery.refetch();
                  }}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : membershipPagesQuery.isPending && memberships.length === 0 ? (
          <MembershipTableSkeleton />
        ) : memberships.length === 0 ? (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>No memberships recorded</EmptyTitle>
              <EmptyDescription>
                This workspace does not have project memberships to display yet.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {membershipPagesQuery.isError ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Membership refresh failed</AlertTitle>
                <AlertDescription>
                  {formatAtlasErrorMessage(
                    membershipPagesQuery.error,
                    "Loaded memberships are shown below, but the latest refresh failed.",
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-4 py-3">Member</TableHead>
                    <TableHead className="px-4 py-3">Role</TableHead>
                    <TableHead className="px-4 py-3">Status</TableHead>
                    <TableHead className="px-4 py-3">Recorded</TableHead>
                    <TableHead className="px-4 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.map((membership) => {
                    const timeline = getMembershipTimeline(membership);
                    const rowDisabled = controlsDisabled || membership.status === "removed";

                    return (
                      <TableRow key={membership.id}>
                        <TableCell className="px-4 py-3 align-top whitespace-normal">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">
                              {membership.user?.name ?? membership.userId}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {membership.user?.email ?? "Organization member details unavailable."}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {membership.userId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top whitespace-normal">
                          {canManageMembers && !isArchived ? (
                            <div className="flex max-w-sm flex-col gap-2">
                              <Select
                                key={`${membership.id}-role-${membership.role}`}
                                defaultValue={membership.role}
                                disabled={rowDisabled}
                                onValueChange={(value) => {
                                  void updateMembershipRole(membership, value as ProjectRole);
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel>Project roles</SelectLabel>
                                    {PROJECT_ROLE_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {getProjectRoleDescription(membership.role)}
                              </p>
                            </div>
                          ) : (
                            <div className="flex max-w-sm flex-col gap-2">
                              <Badge variant="outline">{membership.role}</Badge>
                              <p className="text-xs text-muted-foreground">
                                {getProjectRoleDescription(membership.role)}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top whitespace-normal">
                          {canManageMembers && !isArchived && membership.status !== "removed" ? (
                            <div className="flex max-w-40 flex-col gap-2">
                              <Select
                                key={`${membership.id}-status-${membership.status}`}
                                defaultValue={membership.status}
                                disabled={rowDisabled}
                                onValueChange={(value) => {
                                  void updateMembershipStatus(
                                    membership,
                                    value as MembershipStatus,
                                  );
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel>Membership status</SelectLabel>
                                    {EDITABLE_MEMBERSHIP_STATUSES.map((status) => (
                                      <SelectItem key={status} value={status}>
                                        {getMembershipStatusLabel(status)}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <Badge
                              variant={membership.status === "active" ? "secondary" : "outline"}
                            >
                              {getMembershipStatusLabel(membership.status as MembershipStatus)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top whitespace-normal text-muted-foreground">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-[0.14em]">
                              {timeline.label}
                            </span>
                            <span>{timeline.value}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top whitespace-normal">
                          {canManageMembers && !isArchived && membership.status !== "removed" ? (
                            <MembershipRemoveAction
                              disabled={rowDisabled}
                              membership={membership}
                              onConfirm={removeMembership}
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">No inline actions</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
        <p className="text-sm text-muted-foreground">
          Showing {memberships.length} of {totalMembers} recorded memberships.
        </p>
        {membershipPagesQuery.hasNextPage ? (
          <Button
            disabled={membershipPagesQuery.isFetchingNextPage}
            variant="outline"
            onClick={() => {
              void membershipPagesQuery.fetchNextPage();
            }}
          >
            {membershipPagesQuery.isFetchingNextPage ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UsersIcon data-icon="inline-start" />
            )}
            Load more
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
