import { useState, useEffect } from 'react';
import { ModuleBuilderState, ModuleBuilderStep, AssemblyRequest, AssemblyResult, AssemblyStatus } from '../types';
import assemblyEngineService from '@/services/assemblyEngineService';
import testSuiteService, { TestSuiteExecution } from '@/services/testSuiteService';
import expertReviewService from '@/services/expertReviewService';
import { Component } from '@/services/componentLibraryService';

const initialState: ModuleBuilderState = {
  currentStep: 'design',
  selectedComponents: [],
  assemblyRequest: {
    target_module_type: 'content',
    design_requirements: '',
    component_preferences: {
      complexity_preference: 'moderate'
    },
    constraints: {
      max_components: 10,
      accessibility_level: 'aa',
      performance_requirements: {
        max_load_time_ms: 3000,
        max_bundle_size_kb: 500
      }
    },
    customization_options: {
      allow_ai_modifications: true,
      preserve_branding: true,
      responsive_breakpoints: ['mobile', 'tablet', 'desktop']
    }
  },
  assemblyResult: null,
  assemblyStatus: null,
  testExecution: null,
  reviewRequest: null,
  loading: false,
  error: null
};

export function useModuleBuilder(initialDesignData?: any) {
  const [state, setState] = useState<ModuleBuilderState>(initialState);

  // Initialize with design data if provided
  useEffect(() => {
    if (initialDesignData) {
      setState(prev => ({
        ...prev,
        assemblyRequest: {
          ...prev.assemblyRequest,
          design_requirements: initialDesignData.description || '',
          target_module_type: initialDesignData.moduleType || 'content'
        }
      }));
    }
  }, [initialDesignData]);

  const updateState = (updates: Partial<ModuleBuilderState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const setStep = (step: ModuleBuilderStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  };

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };

  const handleComponentSelect = (component: Component) => {
    setState(prev => {
      const isSelected = prev.selectedComponents.includes(component.id);
      const newSelectedComponents = isSelected
        ? prev.selectedComponents.filter(id => id !== component.id)
        : [...prev.selectedComponents, component.id];

      return {
        ...prev,
        selectedComponents: newSelectedComponents,
        assemblyRequest: {
          ...prev.assemblyRequest,
          component_preferences: {
            ...prev.assemblyRequest.component_preferences,
            preferred_components: newSelectedComponents
          }
        }
      };
    });
  };

  const pollAssemblyStatus = async (assemblyId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await assemblyEngineService.getAssemblyStatus(assemblyId);
        setState(prev => ({ ...prev, assemblyStatus: status }));
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Failed to poll assembly status:', err);
        clearInterval(pollInterval);
      }
    }, 2000);
  };

  const pollTestExecution = async (executionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const execution = await testSuiteService.getExecutionStatus(executionId);
        setState(prev => ({ ...prev, testExecution: execution }));
        
        if (execution.status === 'completed' || execution.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Failed to poll test execution:', err);
        clearInterval(pollInterval);
      }
    }, 1000);
  };

  const handleStartAssembly = async () => {
    if (!state.assemblyRequest.design_requirements) {
      setError('Please provide design requirements');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await assemblyEngineService.assembleComponents(state.assemblyRequest as AssemblyRequest);
      setState(prev => ({
        ...prev,
        assemblyResult: result,
        currentStep: 'assembly'
      }));
      
      if (result.status === 'partial') {
        pollAssemblyStatus(result.assembly_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assembly');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTests = async () => {
    if (!state.assemblyResult) {
      setError('No assembly result to test');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const execution = await testSuiteService.executeTestSuite(
        state.assemblyResult?.assembly_id || 'unknown',
        'assembly',
        ['functionality', 'accessibility', 'performance', 'compatibility']
      );
      
      setState(prev => ({ ...prev, testExecution: execution }));
      pollTestExecution(execution.execution_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run tests');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReview = async () => {
    if (!state.assemblyResult || !state.testExecution) {
      setError('Assembly and testing must be completed before requesting review');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await expertReviewService.submitReviewRequest({
        module_id: state.assemblyResult?.assembly_id || 'unknown',
        module_type: 'content',
        review_type: 'comprehensive',
        priority: 'medium',
        context: {
          project_name: 'Visual Module Builder',
          target_audience: 'General users',
          business_goals: ['User engagement', 'Conversion optimization']
        }
      });
      
      setState(prev => ({ 
        ...prev, 
        reviewRequest: response.request_id,
        currentStep: 'review' 
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request review');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteModule = () => {
    setState(prev => ({ ...prev, currentStep: 'complete' }));
  };

  const getStepStatus = (step: string) => {
    const stepOrder = ['design', 'components', 'assembly', 'testing', 'review', 'complete'];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    const stepIndex = stepOrder.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return {
    state,
    updateState,
    setStep,
    setLoading,
    setError,
    handleComponentSelect,
    handleStartAssembly,
    handleRunTests,
    handleRequestReview,
    handleCompleteModule,
    getStepStatus
  };
}
