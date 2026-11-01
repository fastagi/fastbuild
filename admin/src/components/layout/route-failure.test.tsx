import { render, screen } from '@testing-library/react';
import { ConsoleShellScope, RouteFailure } from '@/components/layout/route-failure';

const failure = (
  <RouteFailure code="404" title="Lost" description="Nothing here" detail="Request ID: req_1">
    <button type="button">Back</button>
  </RouteFailure>
);

describe('RouteFailure', () => {
  it('provides its own main landmark when it stands alone', () => {
    render(failure);

    expect(screen.getByRole('main')).toHaveClass('route-failure-standalone');
    expect(screen.getByRole('heading', { level: 1, name: 'Lost' })).toBeVisible();
    expect(screen.getByText('Request ID: req_1')).toBeVisible();
  });

  it('leaves the main landmark to the console shell', () => {
    render(<ConsoleShellScope>{failure}</ConsoleShellScope>);

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Lost' })).toBeVisible();
  });
});
