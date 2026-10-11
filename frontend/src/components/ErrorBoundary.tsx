import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ErrorScreen } from "./ErrorScreen";

/** Catches a crash anywhere below it and shows the premium 500 screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TVV UI crashed:", error, info.componentStack);
  }

  render() {
    return this.state.failed ? <ErrorScreen code="500" onRetry={() => window.location.reload()} /> : this.props.children;
  }
}
