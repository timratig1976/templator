'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, RotateCcw, X, CheckCircle, Circle, ArrowRight, ArrowLeft } from 'lucide-react';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target_selector?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action_required?: {
    type: 'click' | 'input' | 'upload' | 'wait';
    description: string;
    validation?: string;
  };
  content: {
    text: string;
    image?: string;
    video?: string;
    code_example?: string;
  };
  auto_advance?: boolean;
  duration?: number;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_time: number;
  prerequisites?: string[];
  steps: TutorialStep[];
  completion_reward?: {
    badge: string;
    points: number;
  };
}

interface TutorialSystemProps {
  tutorialId?: string;
  onComplete?: (tutorialId: string) => void;
  onSkip?: (tutorialId: string) => void;
  className?: string;
}

export default function TutorialSystem({
  tutorialId,
  onComplete,
  onSkip,
  className = ''
}: TutorialSystemProps) {
  const [currentTutorial, setCurrentTutorial] = useState<Tutorial | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [highlightElement, setHighlightElement] = useState<Element | null>(null);

  // Sample tutorials
  const tutorials: Tutorial[] = [
    {
      id: 'quick-start',
      title: 'Quick Start Guide',
      description: 'Learn the basics of creating your first HubSpot module',
      category: 'Getting Started',
      difficulty: 'beginner',
      estimated_time: 5,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to Templator',
          description: 'Let\'s create your first HubSpot module together',
          position: 'center',
          content: {
            text: 'Welcome to Templator! This tutorial will guide you through creating your first HubSpot module in just a few minutes. You\'ll learn how to upload a design, configure fields, and deploy to HubSpot.',
            image: '/images/tutorial-welcome.png'
          },
          auto_advance: false
        },
        {
          id: 'upload-design',
          title: 'Upload Your Design',
          description: 'Start by uploading a design file or image',
          target_selector: '[data-tutorial="upload-button"]',
          position: 'bottom',
          action_required: {
            type: 'click',
            description: 'Click the upload button to select a design file'
          },
          content: {
            text: 'Click the "Upload Design" button to select an image or HTML file. Templator supports PNG, JPG, and HTML files up to 10MB.',
            image: '/images/tutorial-upload.png'
          }
        },
        {
          id: 'field-detection',
          title: 'Field Detection',
          description: 'Review the automatically detected fields',
          target_selector: '[data-tutorial="field-list"]',
          position: 'right',
          content: {
            text: 'Templator\'s AI has analyzed your design and detected editable fields. Review the list and make any necessary adjustments.',
            image: '/images/tutorial-fields.png'
          },
          auto_advance: true,
          duration: 3000
        },
        {
          id: 'configure-fields',
          title: 'Configure Fields',
          description: 'Customize field properties and settings',
          target_selector: '[data-tutorial="field-editor"]',
          position: 'left',
          action_required: {
            type: 'input',
            description: 'Edit a field label or add a description'
          },
          content: {
            text: 'Click on any field to customize its properties. You can change the label, type, default value, and add help text.',
            code_example: `{
  "name": "title",
  "label": "Page Title",
  "type": "text",
  "required": true,
  "help_text": "Enter the main title for this section"
}`
          }
        },
        {
          id: 'preview-module',
          title: 'Preview Your Module',
          description: 'See how your module will look in HubSpot',
          target_selector: '[data-tutorial="preview-panel"]',
          position: 'top',
          content: {
            text: 'The preview panel shows how your module will appear in HubSpot. Try changing field values to see live updates.',
            image: '/images/tutorial-preview.png'
          },
          auto_advance: true,
          duration: 4000
        },
        {
          id: 'validation',
          title: 'Validate Module',
          description: 'Ensure your module meets HubSpot standards',
          target_selector: '[data-tutorial="validate-button"]',
          position: 'bottom',
          action_required: {
            type: 'click',
            description: 'Click the validate button to check for issues'
          },
          content: {
            text: 'Before deploying, validate your module to ensure it meets HubSpot standards and will work correctly.',
            image: '/images/tutorial-validation.png'
          }
        },
        {
          id: 'export-deploy',
          title: 'Export or Deploy',
          description: 'Choose how to get your module into HubSpot',
          target_selector: '[data-tutorial="export-section"]',
          position: 'top',
          content: {
            text: 'You can either download your module as a ZIP file for manual upload, or deploy directly to HubSpot using your credentials.',
            image: '/images/tutorial-export.png'
          }
        },
        {
          id: 'completion',
          title: 'Congratulations!',
          description: 'You\'ve completed your first module',
          position: 'center',
          content: {
            text: 'Great job! You\'ve successfully created your first HubSpot module. You can now create more complex modules using the component library and advanced features.',
            image: '/images/tutorial-complete.png'
          },
          auto_advance: false
        }
      ],
      completion_reward: {
        badge: 'First Module Creator',
        points: 100
      }
    },
    {
      id: 'advanced-features',
      title: 'Advanced Features Tour',
      description: 'Explore component library, expert review, and version management',
      category: 'Advanced',
      difficulty: 'intermediate',
      estimated_time: 10,
      prerequisites: ['quick-start'],
      steps: [
        {
          id: 'component-library',
          title: 'Component Library',
          description: 'Browse and use pre-built components',
          target_selector: '[data-tutorial="component-library"]',
          position: 'right',
          content: {
            text: 'The component library contains pre-built, validated HubSpot components that you can use to build complex modules quickly.',
            image: '/images/tutorial-components.png'
          }
        },
        {
          id: 'visual-builder',
          title: 'Visual Module Builder',
          description: 'Build modules with drag-and-drop interface',
          target_selector: '[data-tutorial="visual-builder"]',
          position: 'left',
          content: {
            text: 'Use the visual builder to create modules by dragging and dropping components onto the canvas.',
            video: '/videos/tutorial-visual-builder.mp4'
          }
        },
        {
          id: 'expert-review',
          title: 'Expert Review',
          description: 'Get professional feedback on your modules',
          target_selector: '[data-tutorial="expert-review"]',
          position: 'bottom',
          content: {
            text: 'Submit your modules for expert review to get professional feedback on code quality, performance, and best practices.',
            image: '/images/tutorial-review.png'
          }
        },
        {
          id: 'version-management',
          title: 'Version Management',
          description: 'Track changes and manage module versions',
          target_selector: '[data-tutorial="version-manager"]',
          position: 'top',
          content: {
            text: 'Keep track of module changes with automatic versioning. You can compare versions and rollback if needed.',
            image: '/images/tutorial-versions.png'
          }
        }
      ]
    }
  ];

  useEffect(() => {
    if (tutorialId) {
      const tutorial = tutorials.find(t => t.id === tutorialId);
      if (tutorial) {
        setCurrentTutorial(tutorial);
        setCurrentStep(0);
        setIsVisible(true);
        setIsPlaying(false);
      }
    }
  }, [tutorialId]);

  useEffect(() => {
    if (currentTutorial && isVisible) {
      const step = currentTutorial.steps[currentStep];
      if (step?.target_selector) {
        const element = document.querySelector(step.target_selector);
        if (element) {
          setHighlightElement(element);
          highlightTargetElement(element);
        }
      } else {
        setHighlightElement(null);
        removeHighlight();
      }
    }

    return () => {
      removeHighlight();
    };
  }, [currentStep, currentTutorial, isVisible]);

  const highlightTargetElement = (element: Element) => {
    // Remove existing highlights
    removeHighlight();

    // Add highlight overlay
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-highlight-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
      pointer-events: none;
    `;

    // Add highlight cutout
    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.id = 'tutorial-highlight';
    highlight.style.cssText = `
      position: fixed;
      top: ${rect.top - 4}px;
      left: ${rect.left - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
      z-index: 9999;
      pointer-events: none;
      animation: tutorial-pulse 2s infinite;
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tutorial-pulse {
        0% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); }
        50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.1); }
        100% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);
    document.body.appendChild(highlight);

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const removeHighlight = () => {
    const overlay = document.getElementById('tutorial-highlight-overlay');
    const highlight = document.getElementById('tutorial-highlight');
    if (overlay) overlay.remove();
    if (highlight) highlight.remove();
  };

  const nextStep = () => {
    if (!currentTutorial) return;

    if (currentStep < currentTutorial.steps.length - 1) {
      const currentStepData = currentTutorial.steps[currentStep];
      setCompletedSteps(prev => new Set([...Array.from(prev), currentStepData.id]));
      setCurrentStep(prev => prev + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const completeTutorial = () => {
    if (currentTutorial) {
      setCompletedSteps(prev => new Set([...Array.from(prev), ...currentTutorial.steps.map(s => s.id)]));
      if (onComplete) {
        onComplete(currentTutorial.id);
      }
    }
    closeTutorial();
  };

  const skipTutorial = () => {
    if (currentTutorial && onSkip) {
      onSkip(currentTutorial.id);
    }
    closeTutorial();
  };

  const closeTutorial = () => {
    setIsVisible(false);
    setCurrentTutorial(null);
    setCurrentStep(0);
    setIsPlaying(false);
    removeHighlight();
  };

  const playPause = () => {
    setIsPlaying(!isPlaying);
  };

  const restart = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set<string>());
    setIsPlaying(false);
  };

  if (!currentTutorial || !isVisible) {
    return null;
  }

  const currentStepData = currentTutorial.steps[currentStep];
  const progress = ((currentStep + 1) / currentTutorial.steps.length) * 100;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />

      {/* Tutorial Panel */}
      <div className={`
        fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-w-md w-full
        ${currentStepData.position === 'center' ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2' :
          currentStepData.position === 'top' ? 'top-4 left-1/2 transform -translate-x-1/2' :
          currentStepData.position === 'bottom' ? 'bottom-4 left-1/2 transform -translate-x-1/2' :
          currentStepData.position === 'left' ? 'left-4 top-1/2 transform -translate-y-1/2' :
          'right-4 top-1/2 transform -translate-y-1/2'
        }
        ${className}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">{currentStepData.title}</h3>
            <p className="text-sm text-gray-600">{currentTutorial.title}</p>
          </div>
          <button
            onClick={closeTutorial}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-2 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Step {currentStep + 1} of {currentTutorial.steps.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-gray-700 mb-4">{currentStepData.description}</p>

          {/* Step Content */}
          <div className="space-y-4">
            {currentStepData.content.text && (
              <p className="text-sm text-gray-600">{currentStepData.content.text}</p>
            )}

            {currentStepData.content.image && (
              <img
                src={currentStepData.content.image}
                alt={currentStepData.title}
                className="w-full rounded-lg border border-gray-200"
              />
            )}

            {currentStepData.content.video && (
              <video
                src={currentStepData.content.video}
                controls
                className="w-full rounded-lg border border-gray-200"
              />
            )}

            {currentStepData.content.code_example && (
              <pre className="bg-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                <code>{currentStepData.content.code_example}</code>
              </pre>
            )}

            {currentStepData.action_required && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Action Required:</strong> {currentStepData.action_required.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <button
              onClick={restart}
              className="p-2 text-gray-500 hover:text-gray-700 rounded"
              title="Restart tutorial"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={playPause}
              className="p-2 text-gray-500 hover:text-gray-700 rounded"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={skipTutorial}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Skip Tutorial
            </button>
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 flex items-center space-x-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
            )}
            <button
              onClick={nextStep}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-1"
            >
              <span>{currentStep === currentTutorial.steps.length - 1 ? 'Complete' : 'Next'}</span>
              {currentStep < currentTutorial.steps.length - 1 && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="px-4 pb-4">
          <div className="flex items-center space-x-2">
            {currentTutorial.steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-blue-600'
                    : completedSteps.has(step.id)
                    ? 'bg-green-600'
                    : 'bg-gray-300'
                }`}
                title={step.title}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
