import {
  BellRing,
  Building2,
  Gauge,
  History,
  Settings2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { isFeatureEnabled, isOperatorFeatureEnabled } from '@/config/env';

const operatorNavigation = isFeatureEnabled('operator')
  ? ([
      { icon: Users, labelKey: 'navigation.users', to: '/console/users' },
      { icon: History, labelKey: 'navigation.audit', to: '/console/audit' },
      { icon: SlidersHorizontal, labelKey: 'navigation.settings', to: '/console/settings' },
    ] as const)
  : ([] as const);

const starterNavigation = [
  ...(isOperatorFeatureEnabled('organization')
    ? ([
        {
          icon: Building2,
          labelKey: 'navigation.organizations',
          to: '/console/organizations',
        },
      ] as const)
    : []),
  ...(isOperatorFeatureEnabled('notification')
    ? ([
        {
          icon: BellRing,
          labelKey: 'navigation.notifications',
          to: '/console/notifications',
        },
      ] as const)
    : []),
];

/** Console destinations for the build's enabled features; the sidebar and command palette share it. */
export const navigationItems = [
  {
    icon: Gauge,
    labelKey: 'navigation.overview',
    to: '/console',
  },
  ...operatorNavigation,
  ...starterNavigation,
  {
    icon: Settings2,
    labelKey: 'navigation.preferences',
    to: '/console/preferences',
  },
] as const;

export type NavigationItem = (typeof navigationItems)[number];
