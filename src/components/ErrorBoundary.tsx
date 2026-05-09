'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { captureClientException } from '@/lib/monitoring';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    captureClientException(error, {
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            className="max-w-md w-full text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <Logo size="lg" showText={false} />
            </div>

            {/* Error Icon */}
            <motion.div
              className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
            </motion.div>

            {/* Error Message */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h1 className="text-2xl font-bold text-white mb-4">
                Oeps! Er ging iets mis
              </h1>
              <p className="text-white/80 mb-4">
                Er is een onverwachte fout opgetreden. Onze excuses voor het ongemak.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4 text-left">
                  <summary className="text-white font-medium cursor-pointer mb-2">
                    Technische details (development mode)
                  </summary>
                  <pre className="text-red-300 text-xs overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <button
                onClick={this.handleRetry}
                className="w-full chat-button inline-flex items-center justify-center space-x-2"
              >
                <ArrowPathIcon className="w-5 h-5" />
                <span>Probeer opnieuw</span>
              </button>

              <button
                onClick={this.handleReload}
                className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200"
              >
                Pagina herladen
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="w-full text-white/60 hover:text-white transition-colors py-2"
              >
                Terug naar homepage
              </button>
            </motion.div>

            {/* Support Info */}
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <p className="text-white/60 text-sm">
                Blijft het probleem bestaan? Neem contact op:
              </p>
              <div className="space-y-1">
                <a
                  href="mailto:info@warmeleads.eu"
                  className="block text-brand-pink hover:text-brand-orange transition-colors text-sm"
                >
                  📧 info@warmeleads.eu
                </a>
                <a
                  href="tel:+31850477067"
                  className="block text-brand-pink hover:text-brand-orange transition-colors text-sm"
                >
                  📞 +31 85 047 7067
                </a>
              </div>
            </motion.div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
