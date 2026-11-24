import { fireEvent, within } from '@testing-library/react';

/** Picks the option with the given name in a native Select, as a user choosing from the list. */
export async function chooseOption(trigger: HTMLElement, option: string | RegExp) {
  const choice = await within(trigger).findByRole<HTMLOptionElement>('option', { name: option });
  fireEvent.change(trigger, { target: { value: choice.value } });
}
