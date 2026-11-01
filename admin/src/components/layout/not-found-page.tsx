import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RouteFailure } from '@/components/layout/route-failure';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <RouteFailure
      code="404"
      title={t('errors.notFoundTitle')}
      description={t('errors.notFoundDescription')}
    >
      <Button asChild>
        <Link to="/console">
          <ArrowLeft className="size-4" />
          {t('errors.backToConsole')}
        </Link>
      </Button>
    </RouteFailure>
  );
}
