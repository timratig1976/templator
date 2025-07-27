'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Eye, Download, Tag, Zap, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import componentLibraryService, { Component, ComponentSearchFilters } from '@/services/componentLibraryService';

interface ComponentLibraryBrowserProps {
  onComponentSelect?: (component: Component) => void;
  selectedComponents?: string[];
  maxSelections?: number;
  filterByType?: string;
  className?: string;
}

export default function ComponentLibraryBrowser({
  onComponentSelect,
  selectedComponents = [],
  maxSelections,
  filterByType,
  className = ''
}: ComponentLibraryBrowserProps) {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ComponentSearchFilters>({
    type: filterByType,
    validation_status: 'valid'
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadCategories();
    searchComponents();
  }, []);

  useEffect(() => {
    searchComponents();
  }, [searchQuery, filters, currentPage]);

  const loadCategories = async () => {
    try {
      const categoriesData = await componentLibraryService.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const searchComponents = async () => {
    setLoading(true);
    try {
      const result = await componentLibraryService.searchComponents(
        searchQuery || undefined,
        filters,
        currentPage,
        12
      );
      setComponents(result.components);
      setTotalPages(result.total_pages);
    } catch (error) {
      console.error('Failed to search components:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComponentSelect = (component: Component) => {
    if (onComponentSelect) {
      onComponentSelect(component);
    }
  };

  const isComponentSelected = (componentId: string) => {
    return selectedComponents.includes(componentId);
  };

  const canSelectMore = () => {
    return !maxSelections || selectedComponents.length < maxSelections;
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getComplexityIcon = (level: string) => {
    switch (level) {
      case 'basic': return '🟢';
      case 'intermediate': return '🟡';
      case 'advanced': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Component Library</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              {!filterByType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={filters.type || ''}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="layout">Layout</option>
                    <option value="content">Content</option>
                    <option value="interactive">Interactive</option>
                    <option value="media">Media</option>
                    <option value="form">Form</option>
                    <option value="navigation">Navigation</option>
                  </select>
                </div>
              )}

              {/* Complexity Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
                <select
                  value={filters.complexity_level || ''}
                  onChange={(e) => setFilters({ ...filters, complexity_level: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Levels</option>
                  <option value="basic">Basic</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Quality Score Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Quality Score: {filters.min_quality_score || 0}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.min_quality_score || 0}
                onChange={(e) => setFilters({ ...filters, min_quality_score: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Component Grid */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : components.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500">No components found matching your criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {components.map((component) => (
              <div
                key={component.id}
                className={`
                  border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer
                  ${isComponentSelected(component.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${!canSelectMore() && !isComponentSelected(component.id) 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                  }
                `}
                onClick={() => {
                  if (canSelectMore() || isComponentSelected(component.id)) {
                    handleComponentSelect(component);
                  }
                }}
              >
                {/* Component Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{component.name}</h4>
                    <p className="text-sm text-gray-600 line-clamp-2">{component.description}</p>
                  </div>
                  {isComponentSelected(component.id) && (
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                  )}
                </div>

                {/* Component Metadata */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Quality Score</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQualityColor(component.quality_score)}`}>
                      {component.quality_score}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Complexity</span>
                    <span className="flex items-center space-x-1">
                      <span>{getComplexityIcon(component.complexity_level)}</span>
                      <span className="capitalize">{component.complexity_level}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Usage</span>
                    <span className="text-gray-700">{component.usage_count} times</span>
                  </div>
                </div>

                {/* Tags */}
                {component.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {component.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                    {component.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{component.tags.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* Validation Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-sm">
                    {component.validation_status === 'valid' ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">Validated</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-yellow-600">Pending</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement preview
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Preview component"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 mt-6">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {maxSelections && selectedComponents.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {selectedComponents.length} of {maxSelections} components selected
            </span>
            {selectedComponents.length === maxSelections && (
              <span className="text-blue-600 font-medium">Selection limit reached</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
