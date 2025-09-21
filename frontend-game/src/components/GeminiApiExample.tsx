import React, { useState } from 'react';
import { useGeminiApi } from '../hooks/useGeminiApi';

export const GeminiApiExample: React.FC = () => {
  const [songName, setSongName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const { isLoading, error, result, generateChart, makeRequest, reset } = useGeminiApi();

  const handleGenerateChart = async () => {
    if (!songName.trim()) {
      alert('Please enter a song name');
      return;
    }

    try {
      await generateChart(songName.trim());
    } catch (error) {
      console.error('Chart generation failed:', error);
    }
  };

  const handleCustomRequest = async () => {
    if (!customPrompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    try {
      await makeRequest(customPrompt.trim());
    } catch (error) {
      console.error('Custom request failed:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">Gemini API Integration</h2>
      
      {/* Chart Generation */}
      <div className="mb-8 p-4 border border-gray-600 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-white">Generate Clone Hero Chart</h3>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={songName}
            onChange={(e) => setSongName(e.target.value)}
            placeholder="Enter song name (e.g., 'Bohemian Rhapsody')"
            className="flex-1 px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded"
            disabled={isLoading}
          />
          <button
            onClick={handleGenerateChart}
            disabled={isLoading || !songName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate Chart'}
          </button>
        </div>
      </div>

      {/* Custom Prompt */}
      <div className="mb-8 p-4 border border-gray-600 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-white">Custom Gemini Request</h3>
        <div className="mb-4">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter your custom prompt for Gemini..."
            className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded h-24"
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleCustomRequest}
            disabled={isLoading || !customPrompt.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Send Request'}
          </button>
          <button
            onClick={reset}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-500"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Results */}
      {(error || result) && (
        <div className="p-4 border border-gray-600 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-white">Results</h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-900 border border-red-600 rounded text-red-200">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {result && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white font-medium">Response:</span>
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                >
                  Copy to Clipboard
                </button>
              </div>
              <pre className="bg-gray-900 p-4 rounded text-sm text-gray-300 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Environment Setup Instructions */}
      <div className="mt-8 p-4 bg-yellow-900 border border-yellow-600 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-yellow-200">Setup Instructions</h3>
        <div className="text-yellow-200 text-sm space-y-2">
          <p>1. Create a <code className="bg-gray-800 px-1 rounded">.env</code> file in the frontend-game directory</p>
          <p>2. Add your Gemini API key: <code className="bg-gray-800 px-1 rounded">VITE_GEMINI_API_KEY=your_api_key_here</code></p>
          <p>3. Install dependencies: <code className="bg-gray-800 px-1 rounded">npm install</code></p>
          <p>4. Restart your development server</p>
        </div>
      </div>
    </div>
  );
};
