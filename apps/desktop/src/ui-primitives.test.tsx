import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  MfaCodeInput,
  RecoveryCodesGrid,
  StatCard,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@fastbuild/ui';

function ControlledMfaInput({ onComplete }: { readonly onComplete?: (code: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <MfaCodeInput
      value={value}
      onChange={setValue}
      {...(onComplete ? { onComplete } : {})}
    />
  );
}

describe('@fastbuild/ui primitives', () => {
  describe('MfaCodeInput', () => {
    it('accepts single digits, filters non-digits, supports paste, and navigates on backspace', () => {
      const onComplete = vi.fn();
      render(<ControlledMfaInput onComplete={onComplete} />);

      const digit1 = screen.getByLabelText('Digit 1 of 6') as HTMLInputElement;
      const digit2 = screen.getByLabelText('Digit 2 of 6') as HTMLInputElement;
      const digit6 = screen.getByLabelText('Digit 6 of 6') as HTMLInputElement;

      expect(digit1).toHaveAttribute('inputmode', 'numeric');
      expect(digit1).toHaveAttribute('autocomplete', 'one-time-code');

      // Non-digit ignored
      fireEvent.change(digit1, { target: { value: 'a' } });
      expect(digit1.value).toBe('');

      // Single digit advances focus to box 2
      fireEvent.change(digit1, { target: { value: '4' } });
      expect(digit1.value).toBe('4');
      expect(document.activeElement).toBe(digit2);

      // Backspace on empty box 2 moves back and clears box 1
      fireEvent.keyDown(digit2, { key: 'Backspace' });
      expect(digit1.value).toBe('');
      expect(document.activeElement).toBe(digit1);

      // Paste full 6-digit code (with hyphen noise) fills all boxes and fires onComplete
      fireEvent.paste(digit1, {
        clipboardData: {
          getData: () => '123-456',
        },
      });

      expect(digit1.value).toBe('1');
      expect(digit2.value).toBe('2');
      expect(digit6.value).toBe('6');
      expect(onComplete).toHaveBeenCalledWith('123456');
    });
  });

  describe('RecoveryCodesGrid', () => {
    it('renders 8 codes in a 2-column monospace grid and copies all codes', async () => {
      const codes = [
        'ABCD-1111',
        'EFGH-2222',
        'IJKL-3333',
        'MNOP-4444',
        'QRST-5555',
        'UVWX-6666',
        'YZ12-7777',
        '3456-8888',
      ];
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      const onCopy = vi.fn();

      render(<RecoveryCodesGrid codes={codes} onCopy={onCopy} />);

      const list = screen.getByRole('list', { name: 'Recovery codes' });
      expect(list.className).toContain('grid-cols-2');
      for (const code of codes) {
        expect(screen.getByText(code)).toBeInTheDocument();
      }

      fireEvent.click(screen.getByRole('button', { name: 'Copy all' }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(codes.join('\n'));
        expect(onCopy).toHaveBeenCalledWith(codes.join('\n'));
        expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
      });
    });
  });

  describe('StatCard', () => {
    it('renders label, tabular-nums value, subtext, and optional status pill', () => {
      render(
        <StatCard
          label="Active Sessions"
          value="1,284"
          subtext="Rotating bearer tokens"
          status={{ label: 'Healthy', tone: 'success' }}
        />,
      );

      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      const valueEl = screen.getByText('1,284');
      expect(valueEl.className).toContain('tabular-nums');
      expect(screen.getByText('Rotating bearer tokens')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });
  });

  describe('Tabs, Switch, Dialog, Alert, EmptyState, and Table', () => {
    it('switches tab panels cleanly and toggles Switch aria-checked state', () => {
      const onCheckedChange = vi.fn();
      render(
        <div>
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>
            <TabsContent value="general">General panel</TabsContent>
            <TabsContent value="security">Security panel</TabsContent>
          </Tabs>
          <Switch aria-label="Enable notifications" onCheckedChange={onCheckedChange} />
        </div>,
      );

      expect(screen.getByText('General panel')).toBeInTheDocument();
      expect(screen.queryByText('Security panel')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
      expect(screen.getByText('Security panel')).toBeInTheDocument();

      const toggle = screen.getByRole('switch', { name: 'Enable notifications' });
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('opens and closes Dialog via trigger and Escape key', () => {
      render(
        <Dialog>
          <DialogTrigger>Open modal</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm action</DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Open modal' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm action')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders Alert, EmptyState, and Table primitives', () => {
      render(
        <div>
          <Alert variant="warning">
            <AlertTitle>Session expiring</AlertTitle>
            <AlertDescription>Re-authenticate soon.</AlertDescription>
          </Alert>
          <EmptyState title="No tokens" description="Create a token to begin." />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Requests</TableCell>
                <TableCell>42</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>,
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Session expiring');
      expect(screen.getByText('No tokens')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });
});
