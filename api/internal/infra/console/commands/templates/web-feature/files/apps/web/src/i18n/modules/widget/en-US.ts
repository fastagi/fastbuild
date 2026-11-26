const messages = {
  title: 'Widgets',
  description: 'Widgets of your organization. Owners and admins can create and change them.',
  fields: {
    organization: 'Organization',
    name: 'Name',
    namePlaceholder: 'A short, recognizable name',
  },
  list: {
    title: 'Widgets',
    updated: 'Updated {time}',
    page: 'Page {page} of {pages}',
  },
  editor: {
    createTitle: 'New widget',
    editTitle: 'Rename widget',
    description: 'Every member of the organization can see this widget.',
  },
  delete: {
    title: 'Delete widget',
    description: 'Delete "{name}"? This cannot be undone.',
  },
  empty: {
    noOrganizationTitle: 'No organization yet',
    noOrganization: 'Create or join an organization to keep widgets.',
    noWidgetsTitle: 'No widgets yet',
    noWidgets: 'Widgets created in this organization appear here.',
  },
  actions: {
    create: 'New widget',
    rename: 'Rename',
    save: 'Save',
    delete: 'Delete',
    cancel: 'Cancel',
    retry: 'Retry',
    previous: 'Previous',
    next: 'Next',
  },
  messages: {
    created: 'Widget created.',
    updated: 'Widget renamed.',
    deleted: 'Widget deleted.',
  },
  errors: {
    forbidden: 'Only owners and admins of this organization can change widgets.',
    generic: 'The request could not be completed. Try again.',
    invalid: 'Enter a name of 1 to 255 characters.',
    invalidResponse: 'The server returned an unexpected response. Try again.',
    notFound: 'This widget no longer exists.',
    organizationUnavailable: 'This organization is not available to you.',
    unavailable: 'The service is temporarily unavailable. Try again shortly.',
  },
} as const;

export default messages;
export type WidgetMessages = typeof messages;
