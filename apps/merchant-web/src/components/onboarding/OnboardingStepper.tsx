import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Step {
    label: string;
}

interface OnboardingStepperProps {
    currentStep: number;
    steps: Step[];
}

export function OnboardingStepper({ currentStep, steps }: OnboardingStepperProps) {
    return (
        <div className="flex items-center justify-between w-full">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = stepNumber < currentStep;
                const isCurrent = stepNumber === currentStep;

                return (
                    <div key={index} className="flex items-center flex-1">
                        {/* Step Circle */}
                        <div className="flex flex-col items-center">
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                                    isCompleted && "bg-green-500 text-white",
                                    isCurrent && "bg-indigo-600 text-white ring-4 ring-indigo-100",
                                    !isCompleted && !isCurrent && "bg-gray-200 text-gray-500"
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    stepNumber
                                )}
                            </div>
                            <span
                                className={cn(
                                    "text-xs mt-1.5 font-medium whitespace-nowrap",
                                    isCurrent ? "text-indigo-600" : "text-gray-500"
                                )}
                            >
                                {step.label}
                            </span>
                        </div>

                        {/* Connector Line */}
                        {index < steps.length - 1 && (
                            <div className="flex-1 mx-2">
                                <div
                                    className={cn(
                                        "h-0.5 w-full transition-colors duration-300",
                                        stepNumber < currentStep ? "bg-green-500" : "bg-gray-200"
                                    )}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
