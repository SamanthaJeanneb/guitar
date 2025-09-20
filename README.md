# 🎸 Guitar Super Power

A guitar game with AI-powered chart generation from MP3 files using Google's Gemini API and gesture-based controls.

## Features

- **AI Chart Generation**: Upload MP3 files and generate guitar charts using Gemini AI
- **Gesture Controls**: Use hand gestures to control the game (OpenCV + MediaPipe)
- **Modern Web Interface**: Beautiful React frontend with drag-and-drop file upload
- **Real-time Processing**: Socket.IO integration for real-time communication

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- Python 3.8+
- Google Gemini API key

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
```

Start the backend server:
```bash
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Python Gesture Recognition (Optional)

```bash
cd backend
pip install opencv-python mediapipe numpy pynput
python GuitarSuperPower.py
```

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and add it to your `.env` file

## Usage

1. **Upload MP3**: Use the web interface to upload an MP3 file
2. **Generate Chart**: The AI will analyze the audio and create a guitar chart
3. **Download**: Download the generated `.chart` file
4. **Play**: Use gesture controls to play along with the chart

## API Endpoints

- `POST /api/upload-mp3` - Upload MP3 and generate chart
- `GET /api/charts` - List all generated charts
- `GET /api/charts/:filename` - Download specific chart file

## Chart Format

The generated charts follow a JSON structure compatible with guitar games:
- Song metadata (name, artist, difficulty)
- Timing information (tempo, time signatures)
- Note patterns and chord progressions
- Difficulty levels and sections

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm run dev  # Vite development server
```

## Technologies Used

- **Backend**: Node.js, Express, Socket.IO, Multer
- **Frontend**: React, TypeScript, Vite
- **AI**: Google Gemini API
- **Gesture Recognition**: OpenCV, MediaPipe
- **File Processing**: FFmpeg, fs-extra

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
