'use client';

import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Search, Book, ExternalLink, ThumbsUp, ThumbsDown, ChevronRight } from 'lucide-react';
import knowledgeBaseService, { KnowledgeBaseArticle } from '@/services/knowledgeBaseService';

interface ContextualHelpProps {
  context: string;
  trigger?: React.ReactNode;
  position?: 'right' | 'left' | 'bottom';
  className?: string;
}

export default function ContextualHelp({
  context,
  trigger,
  position = 'right',
  className = ''
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeBaseArticle[]>([]);

  useEffect(() => {
    if (isOpen && context) {
      loadContextualHelp();
    }
  }, [isOpen, context]);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadContextualHelp = async () => {
    setLoading(true);
    try {
      const contextualArticles = await knowledgeBaseService.getContextualHelp(context);
      setArticles(contextualArticles);
    } catch (error) {
      console.error('Failed to load contextual help:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    try {
      const results = await knowledgeBaseService.searchArticles(searchQuery, {}, 5);
      setSearchResults(results.map(r => r.article));
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleArticleClick = async (article: KnowledgeBaseArticle) => {
    const fullArticle = await knowledgeBaseService.getArticle(article.id);
    if (fullArticle) {
      setSelectedArticle(fullArticle);
    }
  };

  const handleVote = async (articleId: string, helpful: boolean) => {
    try {
      await knowledgeBaseService.voteOnArticle(articleId, helpful);
      // Refresh article to show updated votes
      const updatedArticle = await knowledgeBaseService.getArticle(articleId);
      if (updatedArticle) {
        setSelectedArticle(updatedArticle);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'left':
        return 'right-full mr-2';
      case 'bottom':
        return 'top-full mt-2';
      case 'right':
      default:
        return 'left-full ml-2';
    }
  };

  const defaultTrigger = (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors"
      title="Get help"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger || defaultTrigger}
      </div>

      {/* Help Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className={`
            absolute z-50 w-96 bg-white border border-gray-200 rounded-lg shadow-lg
            ${getPositionClasses()}
          `}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Book className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium text-gray-900">
                  {selectedArticle ? selectedArticle.title : 'Help & Documentation'}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {selectedArticle ? (
                /* Article View */
                <div className="p-4">
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="text-sm text-blue-600 hover:text-blue-800 mb-3 flex items-center"
                  >
                    ← Back to help topics
                  </button>

                  <div className="prose prose-sm max-w-none">
                    <div className="mb-4">
                      <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                        <span className={`px-2 py-1 rounded ${
                          selectedArticle.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                          selectedArticle.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedArticle.difficulty}
                        </span>
                        <span>•</span>
                        <span>{selectedArticle.views} views</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-4">
                        Last updated: {new Date(selectedArticle.last_updated).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-sm text-gray-700 leading-relaxed">
                      {selectedArticle.content.split('\n').map((paragraph, index) => (
                        <p key={index} className="mb-3">{paragraph}</p>
                      ))}
                    </div>

                    {/* Tags */}
                    {selectedArticle.tags.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-xs text-gray-500 mb-2">Tags:</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedArticle.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Voting */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600 mb-2">Was this helpful?</div>
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => handleVote(selectedArticle.id, true)}
                          className="flex items-center space-x-1 text-sm text-gray-600 hover:text-green-600"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span>Yes</span>
                        </button>
                        <button
                          onClick={() => handleVote(selectedArticle.id, false)}
                          className="flex items-center space-x-1 text-sm text-gray-600 hover:text-red-600"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          <span>No</span>
                        </button>
                        <div className="text-xs text-gray-500">
                          {selectedArticle.helpful_votes}/{selectedArticle.total_votes} found helpful
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Article List View */
                <div className="p-4">
                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search help articles..."
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Search Results</h4>
                      <div className="space-y-2">
                        {searchResults.map((article) => (
                          <button
                            key={article.id}
                            onClick={() => handleArticleClick(article)}
                            className="w-full text-left p-2 rounded hover:bg-gray-50 border border-gray-200"
                          >
                            <div className="text-sm font-medium text-gray-900">{article.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {article.category} • {article.difficulty}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contextual Articles */}
                  {loading ? (
                    <div className="text-center py-4">
                      <div className="text-sm text-gray-500">Loading help articles...</div>
                    </div>
                  ) : articles.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">
                        Help for {context.replace('-', ' ')}
                      </h4>
                      <div className="space-y-2">
                        {articles.map((article) => (
                          <button
                            key={article.id}
                            onClick={() => handleArticleClick(article)}
                            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                                  {article.title}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {article.difficulty} • {article.views} views
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-sm text-gray-500">No help articles found for this context.</div>
                    </div>
                  )}

                  {/* Quick Links */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Links</h4>
                    <div className="space-y-2">
                      <a
                        href="/docs/user-guide"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full text-left p-2 rounded hover:bg-gray-50 text-sm text-gray-700 hover:text-blue-600"
                      >
                        <span>Complete User Guide</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <a
                        href="/docs/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full text-left p-2 rounded hover:bg-gray-50 text-sm text-gray-700 hover:text-blue-600"
                      >
                        <span>API Documentation</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <a
                        href="/support"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full text-left p-2 rounded hover:bg-gray-50 text-sm text-gray-700 hover:text-blue-600"
                      >
                        <span>Contact Support</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
