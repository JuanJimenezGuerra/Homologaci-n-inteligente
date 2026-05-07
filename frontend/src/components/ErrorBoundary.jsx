import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl m-8">
          <h2 className="text-xl font-bold text-red-700 mb-4">Error en el componente</h2>
          <pre className="text-sm text-red-600 bg-white p-4 rounded overflow-auto mb-4">
            {this.state.error?.toString()}
          </pre>
          {this.state.errorInfo && (
            <pre className="text-xs text-red-500 bg-white p-4 rounded overflow-auto mb-4">
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
