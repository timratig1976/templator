import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import HTMLPreview from '../components/HTMLPreview';

// Mock data for testing
const mockSections = [
  {
    id: 'hero-1',
    name: 'Hero Section',
    type: 'hero' as const,
    html: '<div class="bg-blue-600 text-white p-8"><h1 class="text-4xl font-bold">Welcome</h1><p class="text-lg mt-4">This is our amazing service</p></div>',
    editableFields: [
      {
        id: 'hero-title',
        name: 'Hero Title',
        type: 'text' as const,
        selector: 'h1',
        defaultValue: 'Welcome',
        required: true,
      },
      {
        id: 'hero-desc',
        name: 'Hero Description',
        type: 'text' as const,
        selector: 'p',
        defaultValue: 'This is our amazing service',
        required: false,
      },
    ],
  },
  {
    id: 'content-1',
    name: 'Content Section',
    type: 'content' as const,
    html: '<div class="p-6"><h2 class="text-2xl">Features</h2><ul><li>Feature 1</li><li>Feature 2</li></ul></div>',
    editableFields: [
      {
        id: 'content-title',
        name: 'Section Title',
        type: 'text' as const,
        selector: 'h2',
        defaultValue: 'Features',
        required: true,
      },
    ],
  },
];

const mockComponents = [
  {
    id: 'title-comp',
    name: 'Main Title',
    type: 'text' as const,
    selector: 'h1',
    defaultValue: 'Welcome',
  },
  {
    id: 'desc-comp',
    name: 'Description',
    type: 'text' as const,
    selector: 'p',
    defaultValue: 'This is our amazing service',
  },
];

const mockHTML = '<div class="bg-white"><div class="bg-blue-600 text-white p-8"><h1 class="text-4xl font-bold">Welcome</h1><p class="text-lg mt-4">This is our amazing service</p></div><div class="p-6"><h2 class="text-2xl">Features</h2><ul><li>Feature 1</li><li>Feature 2</li></ul></div></div>';

describe('HTMLPreview Component', () => {
  const mockOnCreateModule = jest.fn();

  const defaultProps = {
    html: mockHTML,
    sections: mockSections,
    components: mockComponents,
    description: 'A modern landing page with hero section and feature list',
    fileName: 'test-design.png',
    onCreateModule: mockOnCreateModule,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(<HTMLPreview {...defaultProps} {...props} />);
  };

  describe('Initial Render', () => {
    it('should render header with file name and description', () => {
      renderComponent();

      expect(screen.getByText('Generated HTML Preview')).toBeInTheDocument();
      expect(screen.getByText('From:')).toBeInTheDocument();
      expect(screen.getByText('test-design.png')).toBeInTheDocument();
      expect(screen.getByText('A modern landing page with hero section and feature list')).toBeInTheDocument();
    });

    it('should display create module button', () => {
      renderComponent();

      const createButton = screen.getByRole('button', { name: /Create HubSpot Module/ });
      expect(createButton).toBeInTheDocument();
    });

    it('should display statistics correctly', () => {
      renderComponent();

      expect(screen.getByText('2')).toBeInTheDocument(); // Sections count
      expect(screen.getByText('Sections')).toBeInTheDocument();
      
      expect(screen.getByText('3')).toBeInTheDocument(); // Editable fields count (2 + 1)
      expect(screen.getByText('Editable Fields')).toBeInTheDocument();
      
      expect(screen.getByText('2')).toBeInTheDocument(); // Components count
      expect(screen.getByText('Components')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should render all tab buttons', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /Preview/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Code/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sections/ })).toBeInTheDocument();
    });

    it('should start with preview tab active', () => {
      renderComponent();

      const previewTab = screen.getByRole('button', { name: /Preview/ });
      expect(previewTab).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should switch to code tab when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const codeTab = screen.getByRole('button', { name: /Code/ });
      await user.click(codeTab);

      expect(codeTab).toHaveClass('bg-blue-600', 'text-white');
      expect(screen.getByText('Generated HTML Code:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copy Code/ })).toBeInTheDocument();
    });

    it('should switch to sections tab when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const sectionsTab = screen.getByRole('button', { name: /Sections/ });
      await user.click(sectionsTab);

      expect(sectionsTab).toHaveClass('bg-blue-600', 'text-white');
      expect(screen.getByText('Identified sections and their editable fields:')).toBeInTheDocument();
    });
  });

  describe('Preview Tab', () => {
    it('should display iframe with generated HTML', () => {
      renderComponent();

      const iframe = screen.getByTitle('HTML Preview');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('srcDoc');
    });

    it('should include Tailwind CSS in iframe', () => {
      renderComponent();

      const iframe = screen.getByTitle('HTML Preview') as HTMLIFrameElement;
      const srcDoc = iframe.getAttribute('srcDoc');
      
      expect(srcDoc).toContain('tailwindcss');
      expect(srcDoc).toContain(mockHTML);
    });

    it('should display responsive breakpoint buttons', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /Mobile/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tablet/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Desktop/ })).toBeInTheDocument();
    });

    it('should change iframe width when breakpoint is selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      const mobileButton = screen.getByRole('button', { name: /Mobile/ });
      await user.click(mobileButton);

      const iframe = screen.getByTitle('HTML Preview');
      expect(iframe).toHaveStyle({ width: '375px' });
    });
  });

  describe('Code Tab', () => {
    it('should display HTML code in code block', async () => {
      const user = userEvent.setup();
      renderComponent();

      const codeTab = screen.getByRole('button', { name: /Code/ });
      await user.click(codeTab);

      const codeElement = screen.getByText(mockHTML);
      expect(codeElement).toBeInTheDocument();
      expect(codeElement.closest('pre')).toHaveClass('bg-gray-900');
    });

    it('should copy code to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });

      renderComponent();

      const codeTab = screen.getByRole('button', { name: /Code/ });
      await user.click(codeTab);

      const copyButton = screen.getByRole('button', { name: /Copy Code/ });
      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockHTML);
    });
  });

  describe('Sections Tab', () => {
    it('should display all sections with correct information', async () => {
      const user = userEvent.setup();
      renderComponent();

      const sectionsTab = screen.getByRole('button', { name: /Sections/ });
      await user.click(sectionsTab);

      expect(screen.getByText('Hero Section')).toBeInTheDocument();
      expect(screen.getByText('Content Section')).toBeInTheDocument();
      expect(screen.getByText('hero')).toBeInTheDocument();
      expect(screen.getByText('content')).toBeInTheDocument();
      expect(screen.getByText('2 fields')).toBeInTheDocument();
      expect(screen.getByText('1 fields')).toBeInTheDocument();
    });

    it('should expand section details when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const sectionsTab = screen.getByRole('button', { name: /Sections/ });
      await user.click(sectionsTab);

      const heroSection = screen.getByText('Hero Section').closest('div');
      await user.click(heroSection!);

      expect(screen.getByText('Editable Fields:')).toBeInTheDocument();
      expect(screen.getByText('Hero Title')).toBeInTheDocument();
      expect(screen.getByText('Hero Description')).toBeInTheDocument();
      expect(screen.getByText('Section HTML:')).toBeInTheDocument();
    });

    it('should collapse section when clicked again', async () => {
      const user = userEvent.setup();
      renderComponent();

      const sectionsTab = screen.getByRole('button', { name: /Sections/ });
      await user.click(sectionsTab);

      const heroSection = screen.getByText('Hero Section').closest('div');
      
      // Expand
      await user.click(heroSection!);
      expect(screen.getByText('Editable Fields:')).toBeInTheDocument();

      // Collapse
      await user.click(heroSection!);
      expect(screen.queryByText('Editable Fields:')).not.toBeInTheDocument();
    });

    it('should display field types with correct icons', async () => {
      const user = userEvent.setup();
      renderComponent();

      const sectionsTab = screen.getByRole('button', { name: /Sections/ });
      await user.click(sectionsTab);

      const heroSection = screen.getByText('Hero Section').closest('div');
      await user.click(heroSection!);

      expect(screen.getByText('📝')).toBeInTheDocument(); // Text field icon
      expect(screen.getByText('text')).toBeInTheDocument(); // Field type badge
      expect(screen.getByText('Required')).toBeInTheDocument(); // Required badge
    });
  });

  describe('Section Type Colors', () => {
    it('should apply correct colors for different section types', async () => {
      const user = userEvent.setup();
      renderComponent();

      const sectionsTab = screen.getByRole('button', { name: /Sections/ });
      await user.click(sectionsTab);

      const heroTag = screen.getByText('hero');
      const contentTag = screen.getByText('content');

      expect(heroTag).toHaveClass('bg-blue-100', 'text-blue-800');
      expect(contentTag).toHaveClass('bg-green-100', 'text-green-800');
    });
  });

  describe('Create Module Button', () => {
    it('should call onCreateModule when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const createButton = screen.getByRole('button', { name: /Create HubSpot Module/ });
      await user.click(createButton);

      expect(mockOnCreateModule).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty sections gracefully', () => {
      renderComponent({ sections: [] });

      expect(screen.getByText('0')).toBeInTheDocument(); // Sections count
      expect(screen.getByText('0')).toBeInTheDocument(); // Fields count
    });

    it('should handle empty components gracefully', () => {
      renderComponent({ components: [] });

      expect(screen.getByText('0')).toBeInTheDocument(); // Components count
    });

    it('should handle missing description', () => {
      renderComponent({ description: '' });

      expect(screen.getByText('From:')).toBeInTheDocument();
      expect(screen.queryByText('A modern landing page')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive on different screen sizes', () => {
      renderComponent();

      const container = screen.getByText('Generated HTML Preview').closest('div');
      expect(container).toHaveClass('max-w-6xl', 'mx-auto');
    });

    it('should stack stats on mobile', () => {
      renderComponent();

      const statsContainer = screen.getByText('Sections').closest('div')?.parentElement;
      expect(statsContainer).toHaveClass('grid-cols-1', 'md:grid-cols-3');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for tabs', () => {
      renderComponent();

      const previewTab = screen.getByRole('button', { name: /Preview/ });
      const codeTab = screen.getByRole('button', { name: /Code/ });
      const sectionsTab = screen.getByRole('button', { name: /Sections/ });

      expect(previewTab).toBeInTheDocument();
      expect(codeTab).toBeInTheDocument();
      expect(sectionsTab).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderComponent();

      const codeTab = screen.getByRole('button', { name: /Code/ });
      codeTab.focus();
      await user.keyboard('{Enter}');

      expect(codeTab).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should have proper iframe title', () => {
      renderComponent();

      const iframe = screen.getByTitle('HTML Preview');
      expect(iframe).toBeInTheDocument();
    });
  });
});
