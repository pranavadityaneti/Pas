import React from 'react';
import { Check } from 'lucide-react';

interface OnboardingStepperProps {
    currentStep: number;
    steps: { label: string; description?: string }[];
}

export function OnboardingStepper({ currentStep, steps }: OnboardingStepperProps) {
    return (
        <div className="w-full py-4">
            <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < currentStep;
                    const isActive = stepNumber === currentStep;
                    const isUpcoming = stepNumber > currentStep;

                    return (
                        <React.Fragment key={index}>
                            {/* Step Circle + Label */}
                            <div className="flex flex-col items-center relative">
                                <div
                                    className={`
                                        w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                                        transition-all duration-300 ease-out
                                        ${isCompleted
                                            ? 'bg-gray-900 text-white'
                                            : isActive
                                                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                                                : 'bg-gray-200 text-gray-500'
                                        }
                                    `}
                                >
                                    {isCompleted ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        stepNumber
                                    )}
                                </div>
                                <span
                                    className={`
                                        mt-2 text-xs font-medium text-center max-w-[80px]
                                        ${isActive ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'}
                                    `}
                                >
                                    {step.label}
                                </span>
                                {step.description && (
                                    <span className="text-[10px] text-gray-400 text-center max-w-[80px]">
                                        {step.description}
                                    </span>
                                )}
                            </div>

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="flex-1 mx-2 h-0.5 relative top-[-12px]">
                                    <div className="absolute inset-0 bg-gray-200 rounded-full" />
                                    <div
                                        className={`
                                            absolute inset-y-0 left-0 bg-gray-900 rounded-full
                                            transition-all duration-500 ease-out
                                        `}
                                        style={{
                                            width: isCompleted ? '100%' : isActive ? '50%' : '0%'
                                        }}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
