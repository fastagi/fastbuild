import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * A styled native `<select>` behind the shadcn Select composition. The console's selects are short
 * fixed lists, so the browser's own control gives keyboard, screen reader, form and phone-picker
 * behavior without shipping a listbox engine. The parts below are declarative markers: `Select`
 * reads them and renders one `<select>`.
 *
 *   <Select value onValueChange name>
 *     <SelectTrigger id aria-label className><SelectValue placeholder /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value>Label</SelectItem>
 *       <SelectGroup><SelectLabel>Group</SelectLabel>…</SelectGroup>
 *     </SelectContent>
 *   </Select>
 */

type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  form?: string;
  disabled?: boolean;
  required?: boolean;
  children?: React.ReactNode;
};

type SelectTriggerProps = Omit<
  React.ComponentProps<'select'>,
  'value' | 'defaultValue' | 'onChange' | 'multiple'
>;

type SelectItemProps = { value: string; disabled?: boolean; children?: React.ReactNode };

const SelectTrigger: (props: SelectTriggerProps) => null = () => null;

const SelectValue: (props: { placeholder?: string }) => null = () => null;

const SelectContent: (props: { className?: string; children?: React.ReactNode }) => null = () =>
  null;

const SelectGroup: (props: { children?: React.ReactNode }) => null = () => null;

const SelectLabel: (props: { children?: React.ReactNode }) => null = () => null;

const SelectItem: (props: SelectItemProps) => null = () => null;

const SelectSeparator: (props: { className?: string }) => null = () => null;

function textOf(node: React.ReactNode): string {
  let text = '';
  React.Children.forEach(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      text += String(child);
    } else if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      text += textOf(child.props.children);
    }
  });
  return text;
}

function renderOptions(children: React.ReactNode): React.ReactNode[] {
  const options: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }
    if (child.type === SelectItem) {
      const { value, disabled, children: label } = child.props as SelectItemProps;
      options.push(
        <option key={value} value={value} disabled={disabled}>
          {textOf(label)}
        </option>,
      );
    } else if (child.type === SelectGroup) {
      const groupChildren = (child.props as { children?: React.ReactNode }).children;
      let label = '';
      const items: React.ReactNode[] = [];
      React.Children.forEach(groupChildren, (part) => {
        if (React.isValidElement(part) && part.type === SelectLabel) {
          label = textOf((part.props as { children?: React.ReactNode }).children);
        } else {
          items.push(part);
        }
      });
      options.push(
        <optgroup key={child.key ?? label} label={label}>
          {renderOptions(items)}
        </optgroup>,
      );
    } else if (child.type === React.Fragment) {
      options.push(...renderOptions((child.props as { children?: React.ReactNode }).children));
    }
  });
  return options;
}

function Select({
  value,
  defaultValue,
  onValueChange,
  name,
  form,
  disabled,
  required,
  children,
}: SelectProps) {
  let trigger: SelectTriggerProps = {};
  let placeholder: string | undefined;
  let options: React.ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }
    if (child.type === SelectTrigger) {
      const { children: triggerChildren, ...rest } = child.props as SelectTriggerProps;
      trigger = rest;
      React.Children.forEach(triggerChildren, (part) => {
        if (React.isValidElement(part) && part.type === SelectValue) {
          placeholder = (part.props as { placeholder?: string }).placeholder;
        }
      });
    } else if (child.type === SelectContent) {
      options = renderOptions((child.props as { children?: React.ReactNode }).children);
    }
  });

  const { className, ...triggerProps } = trigger;
  const empty = (value ?? defaultValue ?? '') === '';

  return (
    <div className={cn('relative w-full', className)}>
      <select
        {...triggerProps}
        name={name}
        form={form}
        disabled={disabled}
        required={required}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        onChange={(event) => onValueChange?.(event.target.value)}
        data-slot="select-trigger"
        data-placeholder={empty && placeholder ? '' : undefined}
        className="flex h-9 w-full cursor-pointer appearance-none truncate rounded-md border border-input bg-transparent py-2 pl-3 pr-8 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground dark:scheme-dark"
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
      />
    </div>
  );
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
