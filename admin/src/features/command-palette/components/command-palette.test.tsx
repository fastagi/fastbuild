import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import '@/i18n';
import { CommandPalette } from '@/features/command-palette/components/command-palette';
import { isPaletteShortcut } from '@/features/command-palette/shortcut';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

function renderPalette() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CommandPalette />
    </QueryClientProvider>,
  );
}

describe('CommandPalette', () => {
  afterEach(() => navigate.mockReset());

  it('treats Cmd+K and Ctrl+K as the shortcut, not a plain K', () => {
    expect(isPaletteShortcut({ key: 'k', metaKey: true, ctrlKey: false })).toBe(true);
    expect(isPaletteShortcut({ key: 'K', metaKey: false, ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: 'k', metaKey: false, ctrlKey: false })).toBe(false);
  });

  it('opens from the keyboard, filters commands, and runs the highlighted one', () => {
    renderPalette();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = screen.getByRole('combobox', { name: 'Search commands' });
    expect(screen.getByRole('option', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.change(input, { target: { value: 'pref' } });
    expect(screen.queryByRole('option', { name: 'Overview' })).not.toBeInTheDocument();
    const preferences = screen.getByRole('option', { name: 'Preferences' });
    expect(input).toHaveAttribute('aria-activedescendant', preferences.id);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith({ to: '/console/preferences' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('moves with the arrow keys and explains when nothing matches', () => {
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: /search or run a command/i }));
    const input = screen.getByRole('combobox', { name: 'Search commands' });

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const options = screen.getAllByRole('option');
    expect(options.at(-1)).toHaveAttribute('aria-selected', 'true');

    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('No command matches “zzz”.')).toBeInTheDocument();
  });
});
