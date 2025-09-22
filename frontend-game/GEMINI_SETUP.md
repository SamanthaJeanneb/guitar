# Gemini API Integration Setup

This project now includes Gemini API integration for generating Clone Hero charts directly from the frontend.

## Setup Instructions

### 1. Install Dependencies
```bash
cd frontend-game
npm install
```

### 2. Get Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key

### 3. Configure Environment Variables
Create a `.env` file in the `frontend-game` directory:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Restart Development Server
```bash
npm run dev
```

## Usage

### Basic Chart Generation
```typescript
import { generateChartFromSongName } from './lib/geminiApi';

const chartContent = await generateChartFromSongName('Bohemian Rhapsody');
console.log(chartContent);
```

### Using the React Hook
```typescript
import { useGeminiApi } from './hooks/useGeminiApi';

function MyComponent() {
  const { isLoading, error, result, generateChart } = useGeminiApi();

  const handleGenerate = async () => {
    try {
      await generateChart('Song Name');
      console.log('Generated chart:', result);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Chart'}
      </button>
      {error && <p>Error: {error}</p>}
      {result && <pre>{result}</pre>}
    </div>
  );
}
```

### Custom Gemini Requests
```typescript
import { makeGeminiRequest } from './lib/geminiApi';

const response = await makeGeminiRequest('Write a poem about coding');
console.log(response);
```

## Features

- **Chart Generation**: Automatically generates Clone Hero charts from song names
- **Custom Prompts**: Make any request to Gemini API
- **React Integration**: Easy-to-use React hook for state management
- **Error Handling**: Comprehensive error handling and loading states
- **TypeScript Support**: Full TypeScript support with proper types

## API Functions

### `generateChartFromSongName(songName: string)`
Generates a complete Clone Hero chart for the specified song.

### `makeGeminiRequest(prompt: string, modelName?: string)`
Makes a custom request to the Gemini API.

### `useGeminiApi()`
React hook that provides:
- `isLoading`: Boolean indicating if a request is in progress
- `error`: Error message if the last request failed
- `result`: Result from the last successful request
- `generateChart(songName)`: Function to generate a chart
- `makeRequest(prompt, modelName?)`: Function to make custom requests
- `reset()`: Function to clear the state

## Integration with Song Upload

The song upload feature now includes an optional checkbox to generate charts using Gemini AI. When enabled:

1. Upload the MP3 file
2. Generate a chart using Gemini AI
3. Save the chart to the song directory
4. Update the song list

This provides a complete workflow for adding songs with AI-generated charts to your game.


