import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center space-y-4 bg-gray-50 rounded-lg border border-gray-200 m-4">
                    <div className="p-4 bg-red-100 rounded-full">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
                    <p className="text-gray-600 max-w-md">
                        The application encountered an unexpected error.
                    </p>
                    {this.state.error && (
                        <div className="bg-white p-4 rounded-md border border-red-100 w-full max-w-lg overflow-auto text-left">
                            <p className="font-mono text-xs text-red-600 break-all">
                                {this.state.error.toString()}
                            </p>
                        </div>
                    )}
                    <Button onClick={this.handleReload} className="gap-2">
                        <RefreshCcw className="w-4 h-4" />
                        Reload Page
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
