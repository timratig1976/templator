import Link from 'next/link';
import { 
  BeakerIcon, 
  ChartBarIcon, 
  CogIcon, 
  DocumentTextIcon,
  LightBulbIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

export default function AdminDashboard() {
  const tools = [
    {
      name: 'AI Maintenance',
      description: 'Refine and test AI prompts for split detection, HTML generation, and enhancement',
      href: '/admin/ai-maintenance',
      icon: BeakerIcon,
      color: 'bg-blue-500',
      features: ['Prompt Editor', 'Split Simulation', 'Version Control', 'Performance Metrics']
    },
    {
      name: 'System Metrics',
      description: 'Monitor AI performance, user satisfaction, and system health',
      href: '/admin/metrics',
      icon: ChartBarIcon,
      color: 'bg-green-500',
      features: ['Performance Dashboard', 'User Feedback', 'Error Tracking', 'Usage Analytics']
    },
    {
      name: 'Configuration',
      description: 'Manage system settings, API keys, and feature flags',
      href: '/admin/config',
      icon: CogIcon,
      color: 'bg-purple-500',
      features: ['API Settings', 'Feature Flags', 'Environment Config', 'Security Settings']
    },
    {
      name: 'Documentation',
      description: 'Internal documentation, API references, and troubleshooting guides',
      href: '/admin/docs',
      icon: DocumentTextIcon,
      color: 'bg-yellow-500',
      features: ['API Docs', 'Troubleshooting', 'Architecture', 'Best Practices']
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Administrative Dashboard</h2>
        <p className="mt-2 text-gray-600">
          Manage and maintain Templator AI systems, monitor performance, and refine AI capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <Link
            key={tool.name}
            href={tool.href}
            className="group relative bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className={`${tool.color} p-3 rounded-lg`}>
                <tool.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                  {tool.name}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {tool.description}
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {tool.features.map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <div className="absolute top-4 right-4">
              <svg
                className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <LightBulbIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              Getting Started
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
              Start with <strong>AI Maintenance</strong> to refine split detection prompts. 
              Upload test design files and experiment with prompt improvements to enhance AI accuracy.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <WrenchScrewdriverIcon className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">
              Maintenance Mode
            </h3>
            <p className="mt-1 text-sm text-red-700">
              This is a maintenance area for system administrators. Changes made here affect 
              the production AI systems. Always test thoroughly before applying changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
