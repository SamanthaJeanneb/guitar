import { useState } from 'react';
import { generateChartFromSongName, makeGeminiRequest } from '../lib/geminiApi';

export interface GeminiApiState {
  isLoading: boolean;
  error: string | null;
  result: string | null;
}

export function useGeminiApi() {
  const [state, setState] = useState<GeminiApiState>({
    isLoading: false,
    error: null,
    result: null,
  });

  const generateChart = async (songName: string) => {
    setState({ isLoading: true, error: null, result: null });
    
    try {
      const chartContent = await generateChartFromSongName(songName);
      setState({ isLoading: false, error: null, result: chartContent });
      return chartContent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate chart';
      setState({ isLoading: false, error: errorMessage, result: null });
      throw error;
    }
  };

  const makeRequest = async (prompt: string, modelName?: string) => {
    setState({ isLoading: true, error: null, result: null });
    
    try {
      const response = await makeGeminiRequest(prompt, modelName);
      setState({ isLoading: false, error: null, result: response });
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to make Gemini request';
      setState({ isLoading: false, error: errorMessage, result: null });
      throw error;
    }
  };

  const reset = () => {
    setState({ isLoading: false, error: null, result: null });
  };

  return {
    ...state,
    generateChart,
    makeRequest,
    reset,
  };
}
