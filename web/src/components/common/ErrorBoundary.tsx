import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, Button } from 'antd';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error Boundary caught:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex items-center justify-center min-h-screen bg-gray-50">
                    <div className="max-w-md w-full p-6">
                        <Alert
                            title="Something went wrong"
                            description={
                                <div>
                                    <p className="mb-4">
                                        {this.state.error?.message || 'An unexpected error occurred'}
                                    </p>
                                    <Button type="primary" onClick={this.handleReset}>
                                        Try Again
                                    </Button>
                                </div>
                            }
                            type="error"
                            showIcon
                        />
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
