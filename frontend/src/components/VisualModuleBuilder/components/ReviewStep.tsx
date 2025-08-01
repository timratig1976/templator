import React from 'react';
import { ArrowLeft, Clock, Eye, Download } from 'lucide-react';
import { StepComponentProps } from '../types';

interface ReviewStepProps extends StepComponentProps {
  onRequestReview: () => void;
  onCompleteModule: () => void;
}

export default function ReviewStep({ state, onStepChange, onRequestReview, onCompleteModule }: ReviewStepProps) {
  const hasRequestedReview = state.reviewRequest !== null;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Expert Review</h3>

      {!hasRequestedReview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800">
            <strong>Expert Review:</strong> Our team of HubSpot experts will review your module for 
            best practices, optimization opportunities, and compliance with HubSpot standards.
          </div>
        </div>
      )}

      {hasRequestedReview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium text-blue-900">Review Requested</div>
              <div className="text-sm text-blue-700">
                Request ID: {state.reviewRequest}
              </div>
              <div className="text-sm text-blue-700">
                Your module has been submitted for expert review. You'll receive feedback within 24-48 hours.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => onStepChange('testing')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Testing</span>
        </button>

        <div className="flex space-x-3">
          {!hasRequestedReview && (
            <button
              onClick={onRequestReview}
              disabled={!state.testExecution || state.testExecution.status !== 'completed'}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Eye className="w-4 h-4" />
              <span>Request Expert Review</span>
            </button>
          )}

          {hasRequestedReview && (
            <button
              onClick={onCompleteModule}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Complete & Download</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
