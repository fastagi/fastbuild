import { fireEvent, screen } from '@testing-library/react';

/** Opens a shadcn/Radix Select from the keyboard and picks the option with the given name. */
export async function chooseOption(trigger: HTMLElement, option: string | RegExp) {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}
