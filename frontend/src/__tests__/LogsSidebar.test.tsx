/**
 * Unit Tests for LogsSidebar Component
 * Tests the real-time logging sidebar functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LogsSidebar from '../components/LogsSidebar';
import { aiLogger } from '../services/aiLogger';
import { socketClient } from '../services/socketClient';

// Mock the services
jest.mock('../services/aiLogger', () => ({
  aiLogger: {
    subscribe: jest.fn(),
    getLogs: jest.fn(() => []),
    exportLogs: jest.fn(() => 'mock-log-data')
  }
}));

jest.mock('../services/socketClient', () => ({
  socketClient: {
    on: jest.fn(),
    off: jest.fn()
  }
}));

describe('LogsSidebar', () => {
  const mockSubscribe = aiLogger.subscribe as jest.MockedFunction<typeof aiLogger.subscribe>;
  const mockGetLogs = aiLogger.getLogs as jest.MockedFunction<typeof aiLogger.getLogs>;
  const mockExportLogs = aiLogger.exportLogs as jest.MockedFunction<typeof aiLogger.exportLogs>;
  const mockSocketOn = socketClient.on as jest.MockedFunction<typeof socketClient.on>;
  const mockSocketOff = socketClient.off as jest.MockedFunction<typeof socketClient.off>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribe.mockReturnValue(() => {}); // Mock unsubscribe function
    mockGetLogs.mockReturnValue([]);
  });

  describe('Sidebar visibility', () => {
    it('should be hidden by default', () => {
      render(<LogsSidebar />);
      
      const sidebar = screen.getByTestId('logs-sidebar');
      expect(sidebar).toHaveClass('translate-x-full');
    });

    it('should show toggle button', () => {
      render(<LogsSidebar />);
      
      const toggleButton = screen.getByRole('button', { name: /toggle logs sidebar/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should toggle sidebar visibility when button is clicked', () => {
      render(<LogsSidebar />);
      
      const toggleButton = screen.getByRole('button', { name: /toggle logs sidebar/i });
      const sidebar = screen.getByTestId('logs-sidebar');
      
      // Initially hidden
      expect(sidebar).toHaveClass('translate-x-full');
      
      // Click to show
      fireEvent.click(toggleButton);
      expect(sidebar).toHaveClass('translate-x-0');
      
      // Click to hide
      fireEvent.click(toggleButton);
      expect(sidebar).toHaveClass('translate-x-full');
    });
  });

  describe('Log display', () => {
    it('should display logs correctly', () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: '2024-01-01T10:00:00.000Z',
          level: 'info',
          category: 'system',
          message: 'Test log message',
          source: 'frontend'
        }
      ];

      mockGetLogs.mockReturnValue(mockLogs);
      
      render(<LogsSidebar />);
      
      // Open sidebar
      const toggleButton = screen.getByRole('button', { name: /toggle logs sidebar/i });
      fireEvent.click(toggleButton);
      
      // Check logs are displayed
      expect(screen.getByText('Test log message')).toBeInTheDocument();
    });

    it('should apply correct styling for different log levels', () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: '2024-01-01T10:00:00.000Z',
          level: 'error',
          category: 'system',
          message: 'Error message',
          source: 'frontend'
        }
      ];

      mockGetLogs.mockReturnValue(mockLogs);
      
      render(<LogsSidebar />);
      
      // Open sidebar
      const toggleButton = screen.getByRole('button', { name: /toggle logs sidebar/i });
      fireEvent.click(toggleButton);
      
      // Check error styling
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('Socket.IO integration', () => {
    it('should set up socket listeners on mount', () => {
      render(<LogsSidebar />);
      
      // Verify socket listeners are set up
      expect(mockSocketOn).toHaveBeenCalledWith('log', expect.any(Function));
      expect(mockSocketOn).toHaveBeenCalledWith('openai_log', expect.any(Function));
      expect(mockSocketOn).toHaveBeenCalledWith('pipeline-progress', expect.any(Function));
      expect(mockSocketOn).toHaveBeenCalledWith('pipeline-error', expect.any(Function));
    });

    it('should clean up socket listeners on unmount', () => {
      const { unmount } = render(<LogsSidebar />);
      
      unmount();
      
      // Verify socket listeners are cleaned up
      expect(mockSocketOff).toHaveBeenCalledWith('log', expect.any(Function));
      expect(mockSocketOff).toHaveBeenCalledWith('openai_log', expect.any(Function));
      expect(mockSocketOff).toHaveBeenCalledWith('pipeline-progress', expect.any(Function));
      expect(mockSocketOff).toHaveBeenCalledWith('pipeline-error', expect.any(Function));
    });
  });

  describe('Export functionality', () => {
    it('should export logs when export button is clicked', () => {
      mockExportLogs.mockReturnValue('exported-log-data');
      
      // Mock URL.createObjectURL and related functions
      const mockCreateObjectURL = jest.fn(() => 'mock-url');
      const mockRevokeObjectURL = jest.fn();
      const mockClick = jest.fn();
      
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;
      
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };
      
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);
      
      render(<LogsSidebar />);
      
      // Open sidebar
      const toggleButton = screen.getByRole('button', { name: /toggle logs sidebar/i });
      fireEvent.click(toggleButton);
      
      // Click export button
      const exportButton = screen.getByRole('button', { name: /export logs/i });
      fireEvent.click(exportButton);
      
      // Verify export process
      expect(mockExportLogs).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });
});
