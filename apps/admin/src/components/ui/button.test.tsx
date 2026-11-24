import { render, screen } from '@testing-library/react';
import { Eye } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button layout contract', () => {
  it('keeps icon and label content in one horizontal line', () => {
    render(
      <Button className="flex-col flex-wrap whitespace-normal">
        <Eye aria-hidden="true" />
        Open preview
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Open preview' })).toHaveClass(
      'flex-row!',
      'flex-nowrap!',
      'whitespace-nowrap!'
    );
  });

  it('disables itself and swaps its icon for a spinner while loading', () => {
    render(
      <Button loading>
        <Eye aria-hidden="true" data-testid="icon" />
        Save
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('data-loading');
    expect(button.querySelector('[data-button-spinner]')).not.toBeNull();
  });

  it('is an ordinary button unless told to load', () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button.querySelector('[data-button-spinner]')).toBeNull();
  });

  it('still renders one slotted child with asChild while loading', () => {
    render(
      <Button asChild loading>
        <a href="/console">Console</a>
      </Button>
    );

    expect(screen.getByRole('link', { name: 'Console' })).toHaveAttribute('aria-busy', 'true');
  });
});
