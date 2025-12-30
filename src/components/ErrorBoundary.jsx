/**
 * Error Boundary Component
 * Catches React errors and prevents the entire extension from crashing
 * Provides graceful fallback UI and error reporting
 */

import React from "react";
import { Button } from "@blueprintjs/core";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);

    // Update state with error details
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Optional: Send error to logging service
    // this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // Implement error logging here if you have an error tracking service
    // Example: Sentry, LogRocket, etc.
    try {
      console.log("[ErrorBoundary] Would send to error tracking:", {
        error: error.toString(),
        errorInfo: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
    } catch (e) {
      // Fail silently if logging fails
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Optional: Reload calendar data
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Show custom fallback UI
      return (
        <div
          style={{
            padding: "20px",
            border: "1px solid #d32f2f",
            borderRadius: "4px",
            backgroundColor: "#ffebee",
            margin: "10px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <h3 style={{ color: "#c62828", margin: "0 0 10px 0" }}>
            ⚠️ Calendar Error
          </h3>
          <p style={{ margin: "0 0 15px 0", color: "#555" }}>
            {this.props.componentName || "The calendar component"} encountered
            an error and couldn't render properly.
          </p>

          {this.state.errorCount > 3 && (
            <div
              style={{
                padding: "10px",
                backgroundColor: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: "4px",
                marginBottom: "15px",
              }}
            >
              <strong style={{ color: "#856404" }}>
                Multiple errors detected
              </strong>
              <p style={{ margin: "5px 0 0 0", fontSize: "14px", color: "#856404" }}>
                This component has crashed {this.state.errorCount} times.
                Consider reloading the page.
              </p>
            </div>
          )}

          <details style={{ marginBottom: "15px", cursor: "pointer" }}>
            <summary style={{ color: "#666", fontSize: "14px" }}>
              Technical Details (for debugging)
            </summary>
            <pre
              style={{
                backgroundColor: "#f5f5f5",
                padding: "10px",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "12px",
                marginTop: "10px",
              }}
            >
              <code>
                {this.state.error && this.state.error.toString()}
                {"\n\n"}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </code>
            </pre>
          </details>

          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              intent="primary"
              icon="refresh"
              onClick={this.handleReset}
              text="Try Again"
            />
            <Button
              icon="repeat"
              onClick={this.handleReload}
              text="Reload Page"
            />
            {this.props.onDismiss && (
              <Button
                icon="cross"
                onClick={this.props.onDismiss}
                text="Dismiss"
              />
            )}
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
