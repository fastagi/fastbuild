import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';

interface AccountIdentityProps {
  name: string;
  email: string;
  /** The account identifier, kept behind a copy button because it can be very long. */
  identifier: string;
}

/**
 * An account in one table cell: name, then email. The email truncates in a table, where its title
 * holds the full address, and wraps anywhere on a phone, where a title cannot be read.
 */
export function AccountIdentity({ name, email, identifier }: AccountIdentityProps) {
  const { t } = useTranslation();
  const label = t('dataTable.copyIdentifier', { identifier });

  const copy = async () => {
    if (await copyText(identifier)) {
      toast.success(t('dataTable.copied', { value: identifier }));
    } else {
      toast.error(t('dataTable.copyFailed'));
    }
  };

  return (
    <div className="min-w-0 sm:max-w-72">
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate font-medium" title={name}>
          {name}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6 shrink-0 text-muted-foreground [&_svg]:size-3.5"
          aria-label={label}
          title={label}
          onClick={() => void copy()}
        >
          <Copy aria-hidden="true" />
        </Button>
      </div>
      <div
        className="text-xs [overflow-wrap:anywhere] text-muted-foreground sm:truncate"
        title={email}
      >
        {email}
      </div>
    </div>
  );
}
