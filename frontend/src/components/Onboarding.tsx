import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface OnboardingStep {
  title: string;
  description: string;
  target: string; // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const steps: OnboardingStep[] = [
    {
      title: 'Welcome to Finply',
      description: 'Your AI-powered financial trading sandbox. Let\'s take a quick tour of the key features.',
      target: '',
      position: 'bottom'
    },
    {
      title: 'Navigation Menu',
      description: 'Use the sidebar to navigate between different sections. Features are organized into logical categories.',
      target: '.sidebar-nav',
      position: 'right'
    },
    {
      title: 'Stock Search',
      description: 'Search for any stock symbol to analyze and trade. Start with popular symbols like AAPL or TSLA.',
      target: '.stock-search',
      position: 'bottom'
    },
    {
      title: 'Portfolio Overview',
      description: 'Track your paper trading portfolio value, cash balance, and performance metrics.',
      target: '.portfolio-metrics',
      position: 'bottom'
    },
    {
      title: 'Trading Panel',
      description: 'Place buy/sell orders with real-time market data. All trades are simulated with $100,000 starting capital.',
      target: '.trading-panel',
      position: 'left'
    },
    {
      title: 'AI Assistant',
      description: 'Get AI-powered insights, research memos, and trading recommendations for any stock.',
      target: '.ai-assistant',
      position: 'left'
    },
    {
      title: 'Analysis Tools',
      description: 'Access technical analysis, backtesting, scenario planning, and risk simulation tools.',
      target: '.analysis-tools',
      position: 'left'
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = () => {
    setIsVisible(false);
    localStorage.setItem('finply_onboarding_completed', 'true');
    onComplete();
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  useEffect(() => {
    const completed = localStorage.getItem('finply_onboarding_completed');
    if (completed) {
      setIsVisible(false);
      onComplete();
    }
  }, [onComplete]);

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {currentStep + 1}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
              <div className="flex space-x-1 mt-1">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 w-6 rounded-full ${
                      index <= currentStep ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={skipOnboarding}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 leading-relaxed">{step.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200">
          <button
            onClick={prevStep}
            disabled={isFirstStep}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isFirstStep
                ? 'text-slate-400 cursor-not-allowed'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-3">
            <button
              onClick={skipOnboarding}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Skip Tour
            </button>
            <button
              onClick={nextStep}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>{isLastStep ? 'Get Started' : 'Next'}</span>
              {!isLastStep && <ChevronRightIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;