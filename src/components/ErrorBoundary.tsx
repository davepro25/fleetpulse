import { Component, type ReactNode } from 'react';
import { Alert, Button } from './ui';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// One per panel: a crash in the map must not take the truck list down with it.
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error(`${this.props.name} panel crashed`, error);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid gap-2 rounded-lg bg-white p-4 ring-1 ring-slate-200">
        <Alert>{this.props.name} failed to load.</Alert>
        <div>
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
        </div>
      </div>
    );
  }
}
