import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import DesignUpload from '../components/DesignUpload';

// Mock fetch with proper typing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('DesignUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockOnUploadError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  const renderComponent = () => {
    return render(
      <DesignUpload
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );
  };

  describe('Initial Render', () => {
    it('should render upload area with correct initial state', () => {
      renderComponent();

      expect(screen.getByText('Upload Your Design')).toBeInTheDocument();
      expect(screen.getByText('Drag and drop your design file here, or click to browse')).toBeInTheDocument();
      expect(screen.getByText('Supports PNG, JPG, GIF, WebP • Max 10MB')).toBeInTheDocument();
    });

    it('should display supported file types', () => {
      renderComponent();

      expect(screen.getByText('PNG')).toBeInTheDocument();
      expect(screen.getByText('JPG')).toBeInTheDocument();
      expect(screen.getByText('GIF')).toBeInTheDocument();
      expect(screen.getByText('WebP')).toBeInTheDocument();
      
      expect(screen.getByText('High-quality designs')).toBeInTheDocument();
      expect(screen.getByText('Photos and mockups')).toBeInTheDocument();
    });

    it('should display helpful tips', () => {
      renderComponent();

      expect(screen.getByText('💡 Tips for Best Results')).toBeInTheDocument();
      expect(screen.getByText('• Use high-resolution images for better AI analysis')).toBeInTheDocument();
      expect(screen.getByText('• PNG format works best for designs with text')).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('should handle valid PNG file selection', async () => {
      const user = userEvent.setup();
      renderComponent();

      const file = new File(['fake-png-content'], 'test-design.png', { type: 'image/png' });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

      await user.upload(input, file);

      expect(screen.getByText('test-design.png')).toBeInTheDocument();
      expect(screen.getByText(/Ready to convert/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Convert to HTML/ })).toBeInTheDocument();
    });

    it('should handle valid JPG file selection', async () => {
      const user = userEvent.setup();
      renderComponent();

      const file = new File(['fake-jpg-content'], 'photo.jpg', { type: 'image/jpeg' });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

      await user.upload(input, file);

      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      expect(screen.getByText(/Ready to convert/)).toBeInTheDocument();
    });

    it('should reject unsupported file types', async () => {
      const user = userEvent.setup();
      renderComponent();

      const file = new File(['fake-content'], 'document.txt', { type: 'text/plain' });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

      await user.upload(input, file);

      expect(mockOnUploadError).toHaveBeenCalledWith(
        'Please upload a valid image file (PNG, JPG, GIF, or WebP)'
      );
    });

    it('should reject files larger than 10MB', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Create a file larger than 10MB
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large-image.png', { 
        type: 'image/png' 
      });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

      await user.upload(input, largeFile);

      expect(mockOnUploadError).toHaveBeenCalledWith('File size must be less than 10MB');
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag over events', () => {
      renderComponent();
      const dropZone = screen.getByText('Upload Your Design').closest('div');

      fireEvent.dragOver(dropZone!, {
        dataTransfer: {
          files: [new File(['content'], 'test.png', { type: 'image/png' })]
        }
      });

      // Should show dragging state (visual feedback)
      expect(dropZone).toHaveClass('border-blue-400');
    });

    it('should handle successful file drop', () => {
      renderComponent();
      const dropZone = screen.getByText('Upload Your Design').closest('div');

      const file = new File(['fake-content'], 'dropped-design.png', { type: 'image/png' });
      
      fireEvent.drop(dropZone!, {
        dataTransfer: {
          files: [file]
        }
      });

      expect(screen.getByText('dropped-design.png')).toBeInTheDocument();
    });

    it('should handle drag leave events', () => {
      renderComponent();
      const dropZone = screen.getByText('Upload Your Design').closest('div');

      // First drag over
      fireEvent.dragOver(dropZone!);
      expect(dropZone).toHaveClass('border-blue-400');

      // Then drag leave
      fireEvent.dragLeave(dropZone!);
      expect(dropZone).not.toHaveClass('border-blue-400');
    });
  });

  describe('File Upload Process', () => {
    it('should successfully upload and convert file', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Mock successful API response
      const mockResponse = {
        success: true,
        data: {
          fileName: 'test-design.png',
          fileSize: 1024,
          analysis: {
            html: '<div class="test">Generated HTML</div>',
            sections: [],
            components: [],
            description: 'Test design conversion'
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      // Select file
      const file = new File(['fake-content'], 'test-design.png', { type: 'image/png' });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      await user.upload(input, file);

      // Click convert button
      const convertButton = screen.getByRole('button', { name: /Convert to HTML/ });
      await user.click(convertButton);

      // Should show loading state
      expect(screen.getByText('Converting Design to HTML...')).toBeInTheDocument();
      expect(screen.getByText('Uploading...')).toBeInTheDocument();

      // Wait for upload completion
      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalledWith(mockResponse.data);
      });

      // Verify API was called correctly
      expect(global.fetch).toHaveBeenCalledWith('/api/design/upload', {
        method: 'POST',
        body: expect.any(FormData)
      });
    });

    it('should handle upload errors', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Upload failed'
        })
      } as Response);

      // Select file and upload
      const file = new File(['fake-content'], 'test-design.png', { type: 'image/png' });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      await user.upload(input, file);

      const convertButton = screen.getByRole('button', { name: /Convert to HTML/ });
      await user.click(convertButton);

      await waitFor(() => {
        expect(mockOnUploadError).toHaveBeenCalledWith('Upload failed');
      });
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Select file and upload
      const file = new File(['fake-content'], 'test-design.png', { type: 'image/png' });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      await user.upload(input, file);

      const convertButton = screen.getByRole('button', { name: /Convert to HTML/ });
      await user.click(convertButton);

      await waitFor(() => {
        expect(mockOnUploadError).toHaveBeenCalledWith('Network error');
      });
    });

    it('should show progress during upload', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Mock slow response to test progress
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true, data: {} })
          }), 100);
        })
      );

      const file = new File(['fake-content'], 'test-design.png', { type: 'image/png' });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      await user.upload(input, file);

      const convertButton = screen.getByRole('button', { name: /Convert to HTML/ });
      await user.click(convertButton);

      // Should show progress bar
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Converting Design to HTML...')).toBeInTheDocument();
    });
  });

  describe('File Size Formatting', () => {
    it('should format file sizes correctly', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Test different file sizes
      const smallFile = new File(['x'.repeat(1024)], 'small.png', { type: 'image/png' });
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      
      await user.upload(input, smallFile);
      expect(screen.getByText(/1\.00 KB/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      renderComponent();

      const dropZone = screen.getByText('Upload Your Design').closest('div');
      
      // Should be focusable and clickable with keyboard
      dropZone?.focus();
      await user.keyboard('{Enter}');
      
      // File input should be triggered (though hidden)
      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument();
    });

    it('should have proper ARIA labels', () => {
      renderComponent();

      const fileInput = screen.getByRole('textbox', { hidden: true });
      expect(fileInput).toHaveAttribute('accept', 'image/*');
    });
  });
});
