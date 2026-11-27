'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AlertCircle, Boxes, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOrganizationContext,
  useOrganizations,
} from '@/features/organization/hooks/use-organizations';
import {
  useCreateWidget,
  useDeleteWidget,
  useUpdateWidget,
  useWidgets,
} from '@/features/widget/hooks/use-widgets';
import {
  WIDGET_NAME_MAX_LENGTH,
  createWidgetSchema,
  updateWidgetSchema,
} from '@/features/widget/schemas';
import type { Widget } from '@/features/widget/types';
import { resolveWidgetErrorKey } from '@/features/widget/utils/widget-error';
import { useT } from '@/i18n';

const positiveId = /^[1-9]\d{0,15}$/u;

/**
 * Widget console: members browse the active organization's widgets; owners and admins also
 * create, rename, and delete them. The organization and the page live in the URL
 * (`?organization=&page=`) so a view can be shared and survives a reload. The API remains the
 * authorization boundary; hiding write controls is only UX.
 */
export function WidgetWorkspace() {
  const t = useT('widget');
  const organizations = useOrganizations();
  const searchParams = useSearchParams();
  const requestedOrganization = parseId(searchParams.get('organization'));
  const items = organizations.data?.items ?? [];
  const organizationId =
    items.find(item => item.id === requestedOrganization)?.id ?? items[0]?.id ?? null;
  const navigate = useWidgetNavigation();

  if (organizations.isPending) return <ListSkeleton />;
  if (organizations.error) {
    return (
      <ErrorAlert
        message={t(resolveWidgetErrorKey(organizations.error))}
        retryLabel={t('actions.retry')}
        onRetry={() => void organizations.refetch()}
      />
    );
  }
  if (organizationId === null) {
    return (
      <EmptyState title={t('empty.noOrganizationTitle')} description={t('empty.noOrganization')} />
    );
  }

  return (
    <OrganizationWidgets
      key={organizationId}
      organizationId={organizationId}
      organizations={items.map(({ id, name }) => ({ id, name }))}
      page={parseId(searchParams.get('page')) ?? 1}
      onOrganizationChange={id => navigate({ organization: id, page: 1 })}
      onPageChange={page => navigate({ organization: organizationId, page })}
    />
  );
}

function OrganizationWidgets({
  organizationId,
  organizations,
  page,
  onOrganizationChange,
  onPageChange,
}: {
  organizationId: number;
  organizations: { id: number; name: string }[];
  page: number;
  onOrganizationChange: (organizationId: number) => void;
  onPageChange: (page: number) => void;
}) {
  const t = useT('widget');
  const context = useOrganizationContext(organizationId);
  const canManage = context.data?.role === 'owner' || context.data?.role === 'admin';
  const [editor, setEditor] = useState<Widget | 'create' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Widget | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full space-y-2 sm:max-w-xs">
          <Label htmlFor="widget-organization">{t('fields.organization')}</Label>
          <Select
            value={String(organizationId)}
            onValueChange={value => onOrganizationChange(Number(value))}
          >
            <SelectTrigger id="widget-organization" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {organizations.map(organization => (
                <SelectItem key={organization.id} value={String(organization.id)}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage ? (
          <Button
            type="button"
            icon={<Plus className="size-4" />}
            onClick={() => setEditor('create')}
          >
            {t('actions.create')}
          </Button>
        ) : null}
      </div>

      <WidgetList
        organizationId={organizationId}
        page={page}
        canManage={canManage}
        onPageChange={onPageChange}
        onEdit={setEditor}
        onDelete={setDeleteTarget}
      />

      {editor ? (
        <WidgetEditor
          organizationId={organizationId}
          widget={editor === 'create' ? null : editor}
          onClose={() => setEditor(null)}
          onCreated={() => onPageChange(1)}
        />
      ) : null}
      <DeleteWidgetDialog
        organizationId={organizationId}
        widget={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function WidgetList({
  organizationId,
  page,
  canManage,
  onPageChange,
  onEdit,
  onDelete,
}: {
  organizationId: number;
  page: number;
  canManage: boolean;
  onPageChange: (page: number) => void;
  onEdit: (widget: Widget) => void;
  onDelete: (widget: Widget) => void;
}) {
  const t = useT('widget');
  const dateTime = useDateTimeFormat();
  const widgets = useWidgets(organizationId, page);

  if (widgets.isPending) return <ListSkeleton />;
  if (widgets.error && !widgets.data) {
    return (
      <ErrorAlert
        message={t(resolveWidgetErrorKey(widgets.error))}
        retryLabel={t('actions.retry')}
        onRetry={() => void widgets.refetch()}
      />
    );
  }
  const items = widgets.data?.items ?? [];
  const meta = widgets.data?.meta;
  if (items.length === 0) {
    return <EmptyState title={t('empty.noWidgetsTitle')} description={t('empty.noWidgets')} />;
  }

  return (
    <section aria-labelledby="widget-list-heading" className="space-y-3">
      <h2 id="widget-list-heading" className="sr-only">
        {t('list.title')}
      </h2>
      <ul className="divide-y rounded-md border">
        {items.map(widget => (
          <li key={widget.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{widget.name}</p>
              <p className="text-xs text-muted-foreground">
                {t('list.updated', { time: dateTime.format(new Date(widget.updated_at)) })}
              </p>
            </div>
            {canManage ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<Pencil className="size-3.5" />}
                  onClick={() => onEdit(widget)}
                >
                  {t('actions.rename')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<Trash2 className="size-3.5" />}
                  onClick={() => onDelete(widget)}
                >
                  {t('actions.delete')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {widgets.error ? (
        <p role="alert" className="text-sm text-error">
          {t(resolveWidgetErrorKey(widgets.error))}
        </p>
      ) : null}
      {meta && meta.last_page > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t('list.page', { page: meta.current_page, pages: meta.last_page })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={meta.current_page <= 1}
              onClick={() => onPageChange(meta.current_page - 1)}
            >
              {t('actions.previous')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={meta.current_page >= meta.last_page}
              onClick={() => onPageChange(meta.current_page + 1)}
            >
              {t('actions.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WidgetEditor({
  organizationId,
  widget,
  onClose,
  onCreated,
}: {
  organizationId: number;
  widget: Widget | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT('widget');
  const [name, setName] = useState(widget?.name ?? '');
  const [formError, setFormError] = useState<string>();
  const create = useCreateWidget(organizationId);
  const update = useUpdateWidget(organizationId);
  const mutationError = create.error ?? update.error;
  const pending = create.isPending || update.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(undefined);
    try {
      if (widget) {
        if (name.trim() === widget.name) {
          onClose();
          return;
        }
        const input = updateWidgetSchema.safeParse({ name: name.trim() });
        if (!input.success) {
          setFormError(t('errors.invalid'));
          return;
        }
        await update.mutateAsync({ widgetId: widget.id, input: input.data });
        toast.success(t('messages.updated'));
      } else {
        const input = createWidgetSchema.safeParse({ name: name.trim() });
        if (!input.success) {
          setFormError(t('errors.invalid'));
          return;
        }
        await create.mutateAsync(input.data);
        toast.success(t('messages.created'));
        onCreated();
      }
      onClose();
    } catch {
      // The localized mutation error stays visible in the dialog.
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && !pending && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(widget ? 'editor.editTitle' : 'editor.createTitle')}</DialogTitle>
          <DialogDescription>{t('editor.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} aria-busy={pending}>
          <DialogBody className="space-y-5">
            {formError || mutationError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden="true" />
                <AlertDescription>
                  {formError ?? t(resolveWidgetErrorKey(mutationError))}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="widget-name-input">{t('fields.name')}</Label>
              <Input
                id="widget-name-input"
                value={name}
                maxLength={WIDGET_NAME_MAX_LENGTH}
                autoComplete="off"
                required
                disabled={pending}
                placeholder={t('fields.namePlaceholder')}
                onChange={event => setName(event.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {t(widget ? 'actions.save' : 'actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteWidgetDialog({
  organizationId,
  widget,
  onClose,
}: {
  organizationId: number;
  widget: Widget | null;
  onClose: () => void;
}) {
  const t = useT('widget');
  const remove = useDeleteWidget(organizationId);

  const confirm = async () => {
    if (!widget) return;
    try {
      await remove.mutateAsync(widget.id);
      toast.success(t('messages.deleted'));
      onClose();
    } catch (error) {
      toast.error(t(resolveWidgetErrorKey(error)));
    }
  };

  return (
    <Dialog open={widget !== null} onOpenChange={open => !open && !remove.isPending && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('delete.title')}</DialogTitle>
          <DialogDescription>
            {t('delete.description', { name: widget?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={remove.isPending} onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={remove.isPending}
            icon={<Trash2 className="size-4" />}
            onClick={() => void confirm()}
          >
            {t('actions.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErrorAlert({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" aria-hidden="true" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon={<RefreshCw className="size-3.5" />}
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Boxes className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-sm font-medium">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function useWidgetNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  return ({ organization, page }: { organization: number; page: number }) => {
    const params = new URLSearchParams({ organization: String(organization) });
    if (page > 1) params.set('page', String(page));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
}

function useDateTimeFormat(): Intl.DateTimeFormat {
  const locale = useLocale();
  return useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale]
  );
}

function parseId(value: string | null): number | null {
  if (value === null || !positiveId.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
