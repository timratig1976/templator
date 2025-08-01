/**
 * Response Formatting Utilities
 * Handles JSON formatting, HTML generation, and browser-friendly responses
 */

import { Request, Response } from 'express';

/**
 * Helper function to safely get error message
 */
export const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

/**
 * Helper function for JSON syntax highlighting
 */
export const syntaxHighlight = (json: string): string => {
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
};

/**
 * Generate HTML template for browser-friendly JSON viewing
 */
const generateHtmlTemplate = (data: any, endpoint: string): string => {
  const formattedJson = JSON.stringify(data, null, 2);
  const highlightedJson = syntaxHighlight(formattedJson);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Raw Data - ${endpoint}</title>
    <style>
        body {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: #1a1a1a;
            color: #e6e6e6;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            background: #2d2d2d;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #4CAF50;
        }
        .header h1 {
            margin: 0 0 10px 0;
            color: #4CAF50;
            font-size: 24px;
        }
        .header p {
            margin: 5px 0;
            color: #b3b3b3;
        }
        .json-container {
            background: #2d2d2d;
            border-radius: 8px;
            padding: 20px;
            overflow-x: auto;
            border: 1px solid #404040;
        }
        pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .json-key {
            color: #79C0FF;
        }
        .json-string {
            color: #A5D6FF;
        }
        .json-number {
            color: #79C0FF;
        }
        .json-boolean {
            color: #FFA657;
        }
        .json-null {
            color: #FF7B72;
        }
        .copy-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-family: inherit;
            font-size: 14px;
        }
        .copy-btn:hover {
            background: #45a049;
        }
        .metadata {
            background: #1e1e1e;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 3px solid #2196F3;
        }
        .metadata h3 {
            margin: 0 0 10px 0;
            color: #2196F3;
        }
    </style>
</head>
<body>
    <button class="copy-btn" onclick="copyToClipboard()">📋 Copy JSON</button>
    
    <div class="header">
        <h1>🔍 Raw Data Endpoint</h1>
        <p><strong>Endpoint:</strong> ${endpoint}</p>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Format:</strong> Human-readable JSON</p>
    </div>
    
    <div class="metadata">
        <h3>📊 Data Information</h3>
        <p><strong>Data Size:</strong> ${JSON.stringify(data).length.toLocaleString()} characters</p>
        <p><strong>Object Keys:</strong> ${Object.keys(data).length}</p>
        <p><strong>Response Type:</strong> JSON with syntax highlighting</p>
        <p><strong>Browser Optimized:</strong> Yes (detected User-Agent)</p>
    </div>
    
    <div class="json-container">
        <pre id="json-content">${highlightedJson}</pre>
    </div>

    <script>
        function copyToClipboard() {
            const jsonContent = ${JSON.stringify(formattedJson)};
            navigator.clipboard.writeText(jsonContent).then(function() {
                const btn = document.querySelector('.copy-btn');
                const originalText = btn.textContent;
                btn.textContent = '✅ Copied!';
                btn.style.background = '#4CAF50';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '#4CAF50';
                }, 2000);
            }).catch(function(err) {
                console.error('Failed to copy: ', err);
                const btn = document.querySelector('.copy-btn');
                btn.textContent = '❌ Failed';
                btn.style.background = '#f44336';
                setTimeout(() => {
                    btn.textContent = '📋 Copy JSON';
                    btn.style.background = '#4CAF50';
                }, 2000);
            });
        }
        
        // Add download functionality
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                const jsonContent = ${JSON.stringify(formattedJson)};
                const blob = new Blob([jsonContent], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'monitoring-data-' + new Date().toISOString().slice(0, 19) + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        });
    </script>
</body>
</html>`;
};

/**
 * Format JSON response beautifully for both API clients and browsers
 */
export const formatJsonResponse = (req: Request, res: Response, data: any, endpoint: string): void => {
  const acceptHeader = req.get('Accept') || '';
  const userAgent = req.get('User-Agent') || '';
  
  // Check if request is from a browser (not API client)
  const isBrowser = userAgent.includes('Mozilla') && !acceptHeader.includes('application/json');
  
  if (isBrowser) {
    // Return formatted HTML for browser viewing
    const html = generateHtmlTemplate(data, endpoint);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } else {
    // Return JSON for API clients
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  }
};

/**
 * Standard success response formatter
 */
export const formatSuccessResponse = (data: any, meta?: any) => {
  return {
    success: true,
    data,
    ...(meta && { meta: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      ...meta
    }})
  };
};

/**
 * Standard error response formatter
 */
export const formatErrorResponse = (error: string, statusCode: number = 500) => {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    statusCode
  };
};

/**
 * Send formatted error response
 */
export const sendErrorResponse = (res: Response, error: string, statusCode: number = 500): void => {
  res.status(statusCode).json(formatErrorResponse(error, statusCode));
};
