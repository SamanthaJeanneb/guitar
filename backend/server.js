const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();


const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
 cors: {
   origin: "http://localhost:5173",
   methods: ["GET", "POST"]
 }
});


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));


// Serve the web interface
app.use(express.static(path.join(__dirname, 'public')));


// Serve the main interface
app.get('/', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create a temporary directory for processing
    const tempDir = path.join(__dirname, 'temp_uploads');
    fs.ensureDirSync(tempDir);
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});


// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// Helper functions to extract information from AI analysis
function extractArtistFromAnalysis(analysis) {
 const artistMatch = analysis.match(/artist[:\s]+([^,\n]+)/i);
 return artistMatch ? artistMatch[1].trim() : null;
}


function extractGenreFromAnalysis(analysis) {
 const genreMatch = analysis.match(/genre[:\s]+([^,\n]+)/i);
 return genreMatch ? genreMatch[1].trim() : null;
}


function extractBPMFromAnalysis(analysis) {
 const bpmMatch = analysis.match(/bpm[:\s]+(\d+)/i) || analysis.match(/tempo[:\s]+(\d+)/i);
 return bpmMatch ? parseInt(bpmMatch[1]) : null;
}


function extractDifficultyFromAnalysis(analysis) {
 const difficultyMatch = analysis.match(/difficulty[:\s]+(\d+)/i);
 return difficultyMatch ? parseInt(difficultyMatch[1]) : null;
}


function extractSongLengthFromAnalysis(analysis) {
 const lengthMatch = analysis.match(/length[:\s]+(\d+)/i) || analysis.match(/duration[:\s]+(\d+)/i);
 return lengthMatch ? parseInt(lengthMatch[1]) : null;
}


// Chart generation function that searches for song information automatically
async function generateChartFromSongName(songName) {
 try {
   const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  
   // Generate chart from song name only - Gemini will search for all information
   const prompt = `You are a Clone Hero chart creator. Search about the song "${songName}" and create a complete, playable Clone Hero .chart file.


CRITICAL REQUIREMENTS:
1. Output ONLY the .chart file content - no explanations, comments, or additional text
2. Generate COMPLETE charts with actual notes spanning the ENTIRE song duration
3. NO placeholder comments like "// ... continue pattern" or "// Fill in the gaps"
4. NO incomplete sections - every difficulty level must have actual notes
5. NO shortcuts or "concise" responses - generate the FULL chart even if repetitive
6. NO comments about repetitive nature or keeping response concise
7. Generate EVERY note from start to finish of the song


Search for:
- Artist name
- BPM (beats per minute)
- Genre
- Song duration/length in seconds
- Song structure with actual timings


Create a complete .chart file with this exact format:


[Song]
{
 Offset = 0
 Resolution = 192
 Player2 = bass
 Difficulty = 0
 PreviewStart = 0
 PreviewEnd = 0
 Genre = "rock"
 MediaType = "cd"
 MusicStream = "song.ogg"
}
[SyncTrack]
{
 0 = TS 6
 0 = B 60000
 1152 = TS 4
 1152 = B 59000
 36096 = B 40000
 36288 = B 68000
}
[Events]
{
}
[ExpertSingle]
{
 1152 = N 2 0
 1344 = N 3 0
 1536 = N 2 0
 1728 = N 1 0
 1920 = N 1 0
 2112 = N 3 0
 2304 = N 2 0
 2496 = N 1 0
 2688 = N 0 0
 2880 = N 2 0
 3072 = N 0 0
 3264 = N 1 0
 3456 = N 0 0
 3648 = N 2 0
 3840 = N 0 0
 4032 = N 1 0
 4224 = N 2 0
 4416 = N 3 0
 4608 = N 2 0
 4800 = N 1 0
 4992 = N 1 0
 5184 = N 3 0
 5376 = N 2 0
 5568 = N 1 0
 5760 = N 0 0
 5952 = N 2 0
 6144 = N 0 0
 6336 = N 1 0
 6528 = N 0 0
 6720 = N 2 0
 6912 = N 0 0
 7104 = N 1 0
 7296 = N 2 0
 7488 = N 3 0
 7680 = N 2 0
 7872 = N 1 0
 8064 = N 1 0
 8256 = N 3 0
 8448 = N 2 0
 8640 = N 0 0
 8832 = N 1 0
 9024 = N 1 0
 9216 = N 0 0
 9408 = N 0 0
 9600 = N 2 0
 9792 = N 3 0
 9984 = N 2 0
 10176 = N 0 0
 10368 = N 1 0
 10560 = N 1 0
 10752 = N 3 0
 10944 = N 3 0
 11136 = N 1 0
 11328 = N 1 0
 11520 = N 0 0
 11712 = N 0 0
 11904 = N 1 0
 12096 = N 3 0
 12288 = N 2 0
 12480 = N 0 0
 12672 = N 1 0
 12864 = N 1 0
 13056 = N 0 192
 13248 = N 2 192
 13440 = N 0 192
 13632 = N 2 192
 13824 = N 0 192
 14016 = N 2 192
 14208 = N 0 192
 14400 = N 2 192
 14592 = N 0 192
 14784 = N 2 192
 14976 = N 0 192
 15168 = N 2 192
 15360 = N 1 0
 15552 = N 3 0
 15744 = N 2 0
 15936 = N 1 0
 16128 = N 1 0
 16320 = N 3 0
 16512 = N 2 0
 16704 = N 0 0
 16896 = N 1 0
 17088 = N 1 0
 17280 = N 0 0
 17472 = N 0 0
 17664 = N 2 0
 17856 = N 3 0
 18048 = N 2 0
 18240 = N 0 0
 18432 = N 1 0
 18624 = N 1 0
 18816 = N 3 0
 19008 = N 3 0
 19200 = N 1 0
 19392 = N 1 0
 19584 = N 0 0
 19776 = N 0 0
 19968 = N 1 0
 20160 = N 3 0
 20352 = N 2 0
 20544 = N 0 0
 20736 = N 1 0
 20928 = N 1 0
 21120 = N 3 0
 21312 = N 0 0
 21504 = N 2 0
 21696 = N 2 0
 21888 = N 1 0
 22080 = N 0 0
 22272 = N 2 0
 22464 = N 0 0
 22656 = N 2 0
 22848 = N 3 0
 23040 = N 2 0
 23232 = N 1 0
 23424 = N 3 0
 23616 = N 0 0
 23808 = N 2 0
 24000 = N 2 0
 24192 = N 1 0
 24384 = N 0 0
 24576 = N 2 0
 24768 = N 0 0
 24960 = N 2 0
 25152 = N 3 0
 25344 = N 2 0
 25536 = N 1 0
 25728 = N 2 0
 25920 = N 3 0
 26112 = N 2 0
 26304 = N 1 0
 26496 = N 1 0
 26688 = N 3 0
 26880 = N 2 0
 27072 = N 0 0
 27264 = N 1 0
 27456 = N 1 0
 27648 = N 0 0
 27840 = N 0 0
 28032 = N 2 0
 28224 = N 3 0
 28416 = N 2 0
 28608 = N 0 0
 28800 = N 1 0
 28992 = N 1 0
 29184 = N 3 0
 29376 = N 3 0
 29568 = N 1 0
 29760 = N 1 0
 29952 = N 0 0
 30144 = N 0 0
 30336 = N 1 0
 30528 = N 3 0
 30720 = N 2 0
 30912 = N 0 0
 31104 = N 1 0
 31296 = N 1 0
 31488 = N 0 0
 31680 = N 0 0
 31872 = N 1 0
 32064 = N 1 0
 32256 = N 3 0
 32448 = N 3 0
 32640 = N 1 0
 32832 = N 1 0
 33024 = N 0 0
 33216 = N 0 0
 33408 = N 1 0
 33600 = N 3 0
 33792 = N 2 0
 33984 = N 0 0
 34176 = N 2 0
 36288 = N 0 0
 36480 = N 2 0
 36672 = N 1 0
 36864 = N 0 0
 37056 = N 2 0
 37248 = N 1 0
 37440 = N 0 0
 37632 = N 2 0
 37824 = N 0 0
 38016 = N 2 0
 38208 = N 1 0
 38400 = N 0 0
 38592 = N 2 0
 38784 = N 1 0
 38976 = N 0 0
 39168 = N 2 0
 39360 = N 0 0
 39552 = N 2 0
 39744 = N 1 0
 39936 = N 0 0
 40128 = N 2 0
 40320 = N 1 0
 40512 = N 0 0
 40704 = N 2 0
 40896 = N 0 0
 41088 = N 2 0
 41280 = N 1 0
 41472 = N 0 0
 41664 = N 2 0
 41856 = N 1 0
 42048 = N 0 0
 42240 = N 2 0
 42432 = N 0 384
 42432 = N 1 384
 43200 = N 1 0
 43200 = N 2 0
 43296 = N 1 288
 43296 = N 2 288
 43968 = N 0 384
 43968 = N 1 384
 44736 = N 1 0
 44736 = N 2 0
 44832 = N 1 480
 44832 = N 2 480
 45504 = N 3 0
 45696 = N 0 0
 45888 = N 2 0
 46080 = N 2 0
 46272 = N 1 0
 46464 = N 0 0
 46656 = N 2 0
 46848 = N 0 0
 47040 = N 2 0
 47232 = N 3 0
 47424 = N 2 0
 47616 = N 2 0
 47808 = N 3 0
 48000 = N 0 0
 48192 = N 2 0
 48384 = N 2 0
 48576 = N 1 0
 48768 = N 0 0
 48960 = N 2 0
 49152 = N 0 0
 49344 = N 2 0
 49536 = N 3 0
 49728 = N 2 0
 49920 = N 1 0
 50112 = N 0 384
 50112 = N 1 384
 50880 = N 1 0
 50880 = N 2 0
 50976 = N 1 288
 50976 = N 2 288
 51648 = N 0 384
 51648 = N 1 384
 52416 = N 1 0
 52416 = N 2 0
 52512 = N 1 480
 52512 = N 2 480
 53184 = N 3 0
 53376 = N 0 0
 53568 = N 2 0
 53760 = N 2 0
 53952 = N 1 0
 54144 = N 0 0
 54336 = N 2 0
 54528 = N 0 0
 54720 = N 2 0
 54912 = N 3 0
 55104 = N 2 0
 55296 = N 2 0
 55488 = N 3 0
 55680 = N 0 0
 55872 = N 2 0
 56064 = N 2 0
 56256 = N 1 0
 56448 = N 0 0
 56640 = N 2 0
 56832 = N 0 0
 57024 = N 2 0
 57216 = N 3 0
 57408 = N 2 0
 57600 = N 1 0
 57792 = N 1 0
 57792 = N 2 0
 57984 = N 1 0
 57984 = N 2 0
 58176 = N 1 0
 58176 = N 2 0
 58368 = N 1 0
 58368 = N 2 0
 58560 = N 1 0
 58560 = N 2 0
 58752 = N 1 0
 58752 = N 2 0
 58944 = N 1 0
 58944 = N 2 0
 59136 = N 1 0
 59136 = N 2 0
 59328 = N 0 0
 59328 = N 1 0
 59520 = N 0 0
 59520 = N 1 0
 59712 = N 0 0
 59712 = N 1 0
 59904 = N 0 0
 59904 = N 1 0
 60096 = N 0 0
 60096 = N 1 0
 60288 = N 0 0
 60288 = N 1 0
 60480 = N 0 0
 60480 = N 1 0
 60672 = N 0 0
 60672 = N 1 0
 60864 = N 2 0
 60864 = N 3 0
 61056 = N 2 0
 61056 = N 3 0
 61248 = N 2 0
 61248 = N 3 0
 61440 = N 2 0
 61440 = N 3 0
 61632 = N 2 0
 61632 = N 3 0
 61824 = N 2 0
 61824 = N 3 0
 62016 = N 2 0
 62016 = N 3 0
 62208 = N 2 0
 62208 = N 3 0
 62400 = N 1 0
 62400 = N 3 0
 62592 = N 1 0
 62592 = N 3 0
 62784 = N 1 0
 62784 = N 3 0
 62976 = N 1 0
 62976 = N 3 0
 63168 = N 1 0
 63168 = N 3 0
 63360 = N 1 0
 63360 = N 3 0
 63552 = N 1 0
 63552 = N 3 0
 63744 = N 1 0
 63744 = N 3 0
 63936 = N 0 288
 63936 = N 1 288
 64320 = N 0 288
 64320 = N 1 288
 64704 = N 1 288
 64704 = N 3 288
 65088 = N 0 288
 65088 = N 1 288
 65472 = N 0 288
 65472 = N 1 288
 65856 = N 2 288
 65856 = N 3 288
}
 CRITICAL FORMAT REQUIREMENTS - EXACT Clone Hero Format:
1. [Song] section: Use curly braces { } and quote all string values
  Example: [Song] { Offset = 0, Resolution = 192, Player2 = bass, Difficulty = 0, PreviewStart = 0, PreviewEnd = 0, Genre = "rock", MediaType = "cd", MusicStream = "song.ogg" }
2. [SyncTrack] section: Include TS (time signature) entries and BPM changes
  Example: [SyncTrack] { 0 = TS 4, 0 = B 120000, 1152 = TS 6, 1152 = B 130000 }
3. Note format: Use "tick = N fret length" where length is 0 for normal notes, >0 for sustained notes
  Example: "768 = N 2 0" (normal note), "768 = N 2 192" (sustained note)
4. Generate DENSE charts with notes EVERY 192 ticks (every beat) for the ENTIRE song duration
5. Create realistic guitar patterns that match the song's rhythm and structure
6. NO COMMENTS: Do NOT use ANY comments whatsoever - no "//" or "#" comments at all
7. NO PLACEHOLDERS: Do NOT use phrases like "Continue this pattern", "Example", "Ensure you cover"
8. Generate complete charts for ExpertSingle, HardSingle, MediumSingle, EasySingle`;
  
   const result = await model.generateContent(prompt);
   const response = await result.response;
   let chartContent = response.text();
  
   // Clean up any remaining placeholder comments - remove ALL comments
   chartContent = chartContent.replace(/\/\/.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?$/gm, '');
   chartContent = chartContent.replace(/\/\/.*?Continue.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?Example.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?Ensure.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?pattern.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?throughout.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?adapting.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?rhythm.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?sections.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?Start.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?End.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?ACTUAL.*?\n/g, '');
   chartContent = chartContent.replace(/\/\/.*?cover.*?\n/g, '');
  
   // Remove # comments (hash comments)
   chartContent = chartContent.replace(/#.*?\n/g, '');
   chartContent = chartContent.replace(/#.*?$/gm, '');
   chartContent = chartContent.replace(/#.*?Continue.*?\n/g, '');
   chartContent = chartContent.replace(/#.*?Chart data.*?\n/g, '');
   chartContent = chartContent.replace(/#.*?following.*?\n/g, '');
   chartContent = chartContent.replace(/#.*?same rules.*?\n/g, '');
   chartContent = chartContent.replace(/#.*?similar patterns.*?\n/g, '');
  
   // Note: The correct format is already "tick = N fret length" - no conversion needed
  
   // Clean up any double curly braces first
   chartContent = chartContent.replace(/\{\s*\{/g, '{');
   chartContent = chartContent.replace(/\}\s*\}/g, '}');
  
   // Clean up any remaining formatting issues
   chartContent = chartContent.replace(/\}\s*\[/g, '}\n[');
   chartContent = chartContent.replace(/\}\s*\{/g, '}\n{');
  
   // Fix existing SyncTrack format - only convert standalone BPM values, not those already formatted
   chartContent = chartContent.replace(/(\n|^)\s*B\s+([\d.]+)(?=\s|$)/gm, (match, prefix, bpm) => {
     const microseconds = Math.round(60000000 / parseFloat(bpm));
     return `${prefix}0 = B ${microseconds}`;
   });
  
   // Fix existing Events format - convert "E tick "event"" to "tick = E "event""
   chartContent = chartContent.replace(/E\s+(\d+)\s+"([^"]+)"/g, '$1 = E "$2"');
  
   // Clean up any double equals signs that might have been created
   chartContent = chartContent.replace(/(\d+)\s*=\s*(\d+)\s*=\s*([A-Z]\s+\d+)/g, '$1 = $3');
  
   // Add missing newlines between } and next [Section]
   chartContent = chartContent.replace(/\}\s*\[/g, '}\n[');
  
   // Add TS 4 before BPM line in SyncTrack if not present
   chartContent = chartContent.replace(/(\[SyncTrack\]\s*\{\s*)(0 = B \d+)/g, '$1  0 = TS 4\n  $2');
  
   // Fix TS 4 formatting - ensure proper indentation
   chartContent = chartContent.replace(/\[SyncTrack\]\s*\{\s*0 = TS 4\s*\n\s*0 = B \d+/g, (match) => {
     return match.replace(/0 = TS 4\s*\n\s*0 = B/, '  0 = TS 4\n  0 = B');
   });
  
   // Remove duplicate events at the same tick
   chartContent = chartContent.replace(/\[Events\]\s*\{([^}]*)\}/gs, (match, content) => {
     const lines = content.split('\n').filter(line => line.trim());
     const eventMap = new Map();
    
     lines.forEach(line => {
       const eventMatch = line.match(/(\d+)\s*=\s*E\s+"([^"]+)"/);
       if (eventMatch) {
         const tick = eventMatch[1];
         const event = eventMatch[2];
         if (!eventMap.has(tick)) {
           eventMap.set(tick, event);
         }
       }
     });
    
     const uniqueEvents = Array.from(eventMap.entries())
       .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
       .map(([tick, event]) => `  ${tick} = E "${event}"`)
       .join('\n');
    
     return `[Events]\n{\n${uniqueEvents}\n}`;
   });
  
   // Remove unnecessary blank lines inside sections
   chartContent = chartContent.replace(/\{\s*\n\s*\n/g, '{\n');
   chartContent = chartContent.replace(/\n\s*\n\s*\}/g, '\n}');
  
   // Clean up multiple consecutive blank lines
   chartContent = chartContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  
   // Remove blank lines between note entries
   chartContent = chartContent.replace(/(\d+ = N \d+ \d+)\s*\n\s*\n(\d+ = N \d+ \d+)/g, '$1\n$2');
  
   // Verify and fix balanced braces
   chartContent = chartContent.replace(/\{\s*\n\s*\}/g, '{\n}');
  
   // Final cleanup - ensure proper spacing between sections
   chartContent = chartContent.replace(/\}\s*\n\s*\[/g, '}\n\n[');
   chartContent = chartContent.replace(/\}\s*\[/g, '}\n\n[');
  
   // Add newline before [SyncTrack] - handle both with and without existing newlines
   chartContent = chartContent.replace(/(\[Song\]\s*\{[^}]*\})\s*(\[SyncTrack\])/g, '$1\n\n$2');
   chartContent = chartContent.replace(/(\[Song\]\s*\{[^}]*\})\n(\[SyncTrack\])/g, '$1\n\n$2');
  
   // Ensure newlines between all major sections
   chartContent = chartContent.replace(/(\[SyncTrack\]\s*\{[^}]*\})\s*(\[Events\])/g, '$1\n\n$2');
   chartContent = chartContent.replace(/(\[Events\]\s*\{[^}]*\})\s*(\[ExpertSingle\])/g, '$1\n\n$2');
   chartContent = chartContent.replace(/(\[ExpertSingle\]\s*\{[^}]*\})\s*(\[ExpertDoubleBass\])/g, '$1\n\n$2');
   chartContent = chartContent.replace(/(\[ExpertDoubleBass\]\s*\{[^}]*\})\s*(\[HardSingle\])/g, '$1\n\n$2');
   chartContent = chartContent.replace(/(\[HardSingle\]\s*\{[^}]*\})\s*(\[MediumSingle\])/g, '$1\n\n$2');
   chartContent = chartContent.replace(/(\[MediumSingle\]\s*\{[^}]*\})\s*(\[EasySingle\])/g, '$1\n\n$2');
  
   // Fix SyncTrack formatting - ensure proper indentation
   chartContent = chartContent.replace(/\[SyncTrack\]\s*\{\s*0 = TS 4\s*\n\s*0 = B \d+/g, (match) => {
     return match.replace(/0 = TS 4\s*\n\s*0 = B/, '  0 = TS 4\n  0 = B');
   });
  
   // Change event names to use underscores
   chartContent = chartContent.replace(/E\s+"([^"]*)\s+(\d+)"/g, 'E "$1_$2"');
   chartContent = chartContent.replace(/E\s+"([^"]*)\s+(\d+)\s+([^"]*)"/g, 'E "$1_$2_$3"');
  
   // Sort notes strictly ascending by tick in all difficulty sections
   chartContent = chartContent.replace(/\[(ExpertSingle|HardSingle|MediumSingle|EasySingle|ExpertDoubleBass)\]\s*\{([^}]*)\}/gs, (match, sectionName, content) => {
     const lines = content.split('\n').filter(line => line.trim());
     const noteLines = [];
     const otherLines = [];
    
     lines.forEach(line => {
       if (line.match(/\d+\s*=\s*N\s+\d+\s+\d+/)) {
         noteLines.push(line);
       } else {
         otherLines.push(line);
       }
     });
    
     // Sort notes by tick value (extract first number from each line)
     noteLines.sort((a, b) => {
       const matchA = a.match(/^(\d+)/);
       const matchB = b.match(/^(\d+)/);
       if (!matchA || !matchB) return 0;
       const tickA = parseInt(matchA[1]);
       const tickB = parseInt(matchB[1]);
       return tickA - tickB;
     });
    
     const sortedContent = [...otherLines, ...noteLines].join('\n');
     return `[${sectionName}]\n{\n${sortedContent}\n}`;
   });
  
   // Add some sustain notes with nonzero length (every 10th note gets sustain)
   chartContent = chartContent.replace(/(\d+ = N \d+) 0/g, (match, notePart, offset) => {
     const noteNumber = parseInt(notePart.match(/(\d+)/)[1]);
     if (noteNumber % 10 === 0) {
       return `${notePart} 192`;
     }
     return match;
   });
  
   // Clean up any remaining formatting issues
   chartContent = chartContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  
   // Final fix: ensure newlines between all sections (run this last)
   chartContent = chartContent.replace(/\}\s*\[/g, '}\n\n[');
   chartContent = chartContent.replace(/\}\[([A-Z])/g, '}\n\n[$1');
  
   // Fix [Song] section format - add curly braces and quote string values
   chartContent = chartContent.replace(/\[Song\]\s*\n([^[]*?)(?=\[|$)/gs, (match, content) => {
     // Skip if already has curly braces
     if (content.includes('{') && content.includes('}')) {
       return match;
     }
     const lines = content.trim().split('\n').filter(line => line.trim());
     const formattedLines = lines.map(line => {
       if (line.includes('=')) {
         const [key, value] = line.split('=').map(s => s.trim());
         if (key === 'Name' || key === 'Artist' || key === 'Charter' || key === 'Genre' || key === 'MediaType' || key === 'MusicStream') {
           return `  ${key} = "${value}"`;
         } else {
           return `  ${key} = ${value}`;
         }
       }
       return line;
     });
     return `[Song]\n{\n${formattedLines.join('\n')}\n}`;
   });
  
   // Fix [SyncTrack] section format - add curly braces and proper BPM format
   chartContent = chartContent.replace(/\[SyncTrack\]\s*\n([^[]*?)(?=\[|$)/gs, (match, content) => {
     // Skip if already has curly braces
     if (content.includes('{') && content.includes('}')) {
       return match;
     }
     const lines = content.trim().split('\n').filter(line => line.trim());
     const formattedLines = lines.map(line => {
       if (line.includes('B ')) {
         // Convert BPM to microseconds per quarter note: 60000000 / BPM
         const bpmMatch = line.match(/B\s+([\d.]+)/);
         if (bpmMatch) {
           const bpm = parseFloat(bpmMatch[1]);
           const microseconds = Math.round(60000000 / bpm);
           return `  0 = B ${microseconds}`;
         }
       }
       if (line.includes('=')) {
         return `  ${line}`;
       }
       return line;
     });
     // Add TS entry if not present
     if (!content.includes('TS')) {
       formattedLines.unshift('  0 = TS 4');
     }
     return `[SyncTrack]\n{\n${formattedLines.join('\n')}\n}`;
   });
  
   // Fix [Events] section format - add curly braces and proper tick format
   chartContent = chartContent.replace(/\[Events\]\s*\n([^[]*?)(?=\[|$)/gs, (match, content) => {
     // Skip if already has curly braces
     if (content.includes('{') && content.includes('}')) {
       return match;
     }
     const lines = content.trim().split('\n').filter(line => line.trim());
     const formattedLines = lines.map(line => {
       if (line.includes('E ')) {
         // Convert "E tick "event"" to "tick = E "event""
         const eventMatch = line.match(/E\s+(\d+)\s+"([^"]+)"/);
         if (eventMatch) {
           const tick = eventMatch[1];
           const event = eventMatch[2];
           return `  ${tick} = E "${event}"`;
         }
       }
       if (line.includes('=')) {
         return `  ${line}`;
       }
       return line;
     });
     return `[Events]\n{\n${formattedLines.join('\n')}\n}`;
   });
  
   // Fix difficulty sections format - add curly braces
   chartContent = chartContent.replace(/\[(ExpertSingle|HardSingle|MediumSingle|EasySingle|ExpertDoubleBass)\]\s*\n([^[]*?)(?=\[|$)/gs, (match, sectionName, content) => {
     // Skip if already has curly braces
     if (content.includes('{') && content.includes('}')) {
       return match;
     }
     const lines = content.trim().split('\n').filter(line => line.trim());
     const formattedLines = lines.map(line => {
       if (line.includes('=')) {
         return `  ${line}`;
       }
       return line;
     });
     return `[${sectionName}]\n{\n${formattedLines.join('\n')}\n}`;
   });
  
   // Final newline fix - ensure proper spacing between all sections
   chartContent = chartContent.replace(/\}\[([A-Z])/g, '}\n\n[$1');
  
   console.log('Generated chart for', songName);
  
   // Return the cleaned chart content
   return chartContent;
 } catch (error) {
   console.error('Error generating chart:', error);
   throw error;
 }
}


// Generate sample notes for the chart
function generateSampleNotes() {
 const notes = [];
 const startTime = 0;
 const endTime = 180000; // 3 minutes in milliseconds
 const noteInterval = 500; // 500ms between notes
  for (let time = startTime; time < endTime; time += noteInterval) {
   // Generate random notes (0-4 frets, 0-5 strings)
   const fret = Math.floor(Math.random() * 5);
   const string = Math.floor(Math.random() * 6);
  
   notes.push({
     time: time,
     fret: fret,
     string: string,
     length: 400,
     hopo: false,
     hammer_on: false,
     pull_off: false,
     tap: false,
     bend: 0,
     slide: 0,
     harmonic: false,
     palm_mute: false,
     tremolo: false,
     accent: false
   });
 }
  return notes;
}


// Routes
app.get('/', (req, res) => {
 res.status(200).send("received");
});


app.post('/', (req, res) => {
 res.json({message: "a"});
});


// Generate chart from song name only
app.post('/api/generate-chart', async (req, res) => {
 try {
   const { songName } = req.body;


   if (!songName || !songName.trim()) {
     return res.status(400).json({ error: 'Song name is required' });
   }


   if (!process.env.GEMINI_API_KEY) {
     return res.status(500).json({ error: 'Gemini API key not configured' });
   }


   console.log(`Generating chart for: ${songName}`);


   // Generate chart data using Gemini AI
   const chartData = await generateChartFromSongName(songName.trim());


   // Save chart data to file
   const chartFilename = `${songName}.chart`.replace(/[^a-zA-Z0-9\s\-\.]/g, '');
   const chartPath = path.join(uploadsDir, chartFilename);
  
   await fs.writeFile(chartPath, chartData, 'utf8');


   res.json({
     success: true,
     message: 'Chart generated successfully with Clone Hero format',
     chartFile: chartFilename,
     chartContent: chartData
   });


 } catch (error) {
   console.error('Error generating chart:', error);
   res.status(500).json({
     error: 'Failed to generate chart',
     details: error.message
   });
 }
});


// Helper function to parse Clone Hero chart metadata
function parseChartMetadata(chartContent) {
 const metadata = {
   songName: 'Unknown Song',
   artist: 'Unknown Artist',
   difficulty: 3,
   length: 180, // default 3 minutes
   genre: 'Unknown',
   aiGenerated: true
 };


 try {
   // Extract song name
   const nameMatch = chartContent.match(/Name\s*=\s*(.+)/);
   if (nameMatch) metadata.songName = nameMatch[1].trim();


   // Extract artist
   const artistMatch = chartContent.match(/Artist\s*=\s*(.+)/);
   if (artistMatch) metadata.artist = artistMatch[1].trim();


   // Extract genre
   const genreMatch = chartContent.match(/Genre\s*=\s*(.+)/);
   if (genreMatch) metadata.genre = genreMatch[1].trim();


   // Extract charter to determine if AI generated
   const charterMatch = chartContent.match(/Charter\s*=\s*(.+)/);
   if (charterMatch) metadata.aiGenerated = charterMatch[1].trim() === "Gemini";


   // Estimate difficulty based on note density in ExpertSingle section
   const expertSection = chartContent.match(/\[ExpertSingle\][\s\S]*?\n\}/);
   if (expertSection) {
     const noteLines = expertSection[0].match(/\|\s*N\s+\d+/g);
     if (noteLines) {
       const noteCount = noteLines.length;
       if (noteCount < 50) metadata.difficulty = 1;
       else if (noteCount < 100) metadata.difficulty = 2;
       else if (noteCount < 200) metadata.difficulty = 3;
       else if (noteCount < 300) metadata.difficulty = 4;
       else metadata.difficulty = 5;
     }
   }


   // Extract BPM from SyncTrack
   const bpmMatch = chartContent.match(/B\s+(\d+\.?\d*)/);
   const bpm = bpmMatch ? parseFloat(bpmMatch[1]) : 120;
  
   // Estimate length based on last tick in ExpertSingle
   const noteMatches = chartContent.match(/N\s+(\d+)\s+\d+/g);
   if (noteMatches && noteMatches.length > 0) {
     // Find the highest tick value
     let maxTick = 0;
     noteMatches.forEach(match => {
       const tickMatch = match.match(/N\s+(\d+)/);
       if (tickMatch) {
         const tick = parseInt(tickMatch[1]);
         if (tick > maxTick) maxTick = tick;
       }
     });
    
     if (maxTick > 0) {
       // Calculate length using actual BPM: length = (maxTick / resolution) * (60 / BPM)
       metadata.length = Math.floor((maxTick / 192) * (60 / bpm));
     }
   }
 } catch (error) {
   console.log('Error parsing chart metadata:', error.message);
 }


 return metadata;
}


// Get generated charts
app.get('/api/charts', async (req, res) => {
 try {
   const files = await fs.readdir(uploadsDir);
   const chartFiles = files.filter(file => file.endsWith('.chart'));
  
   const charts = await Promise.all(
     chartFiles.map(async (file) => {
       const chartPath = path.join(uploadsDir, file);
       const chartContent = await fs.readFile(chartPath, 'utf8');
       const metadata = parseChartMetadata(chartContent);
      
       return {
         filename: file,
         songName: metadata.songName,
         artist: metadata.artist,
         difficulty: metadata.difficulty,
         length: metadata.length,
         genre: metadata.genre,
         aiGenerated: metadata.aiGenerated
       };
     })
   );


   res.json(charts);
 } catch (error) {
   console.error('Error fetching charts:', error);
   res.status(500).json({ error: 'Failed to fetch charts' });
 }
});


// Download chart file
app.get('/api/charts/:filename', async (req, res) => {
 try {
   const filename = req.params.filename;
   const chartPath = path.join(uploadsDir, filename);
  
   if (!await fs.pathExists(chartPath)) {
     return res.status(404).json({ error: 'Chart file not found' });
   }


   res.download(chartPath);
 } catch (error) {
   console.error('Error downloading chart:', error);
   res.status(500).json({ error: 'Failed to download chart' });
 }
});


// Socket.IO connection handling
io.on('connection', (socket) => {
 console.log('Client connected:', socket.id);


 socket.on('disconnect', () => {
   console.log('Client disconnected:', socket.id);
 });


 // Handle gesture data from Python script
 socket.on('gesture-data', (data) => {
   // Broadcast gesture data to all connected clients
   socket.broadcast.emit('gesture-update', data);
 });
});

// Save chart endpoint
app.post('/api/save-chart', async (req, res) => {
  try {
    const { songName, chartData } = req.body;

    if (!songName || !chartData) {
      return res.status(400).json({ error: 'Song name and chart data are required' });
    }

    const cleanSongName = songName.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_');
    
    // Paths for the song directory and chart file
    const songsDir = path.join(__dirname, '..', 'frontend-game', 'public', 'songs');
    const songDir = path.join(songsDir, cleanSongName);
    const chartPath = path.join(songDir, 'waves.chart');

    // Ensure song directory exists
    await fs.ensureDir(songDir);

    // Write the chart data to waves.chart
    await fs.writeFile(chartPath, chartData, 'utf8');

    res.json({ 
      success: true, 
      chartPath: `public/songs/${cleanSongName}/waves.chart`,
      message: 'Chart saved successfully'
    });

  } catch (error) {
    console.error('Save chart error:', error);
    res.status(500).json({ error: 'Failed to save chart' });
  }
});

// Upload song endpoint
app.post('/api/upload-song', upload.single('song'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const originalName = req.file.originalname;
    const songName = path.parse(originalName).name; // Remove extension
    const cleanSongName = songName.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_');
    
    // Paths for the new song directory and files
    const songsDir = path.join(__dirname, '..', 'frontend-game', 'public', 'songs');
    const songDir = path.join(songsDir, cleanSongName);
    const finalSongPath = path.join(songDir, 'song.mp3');
    const indexJsonPath = path.join(songsDir, 'index.json');

    // Create song directory
    await fs.ensureDir(songDir);

    // Move uploaded file to the song directory as song.mp3
    await fs.move(req.file.path, finalSongPath);

    // Read current index.json
    let songs = [];
    if (await fs.pathExists(indexJsonPath)) {
      const indexContent = await fs.readFile(indexJsonPath, 'utf8');
      songs = JSON.parse(indexContent);
    }

    // Check if song already exists
    const existingSongIndex = songs.findIndex(song => song.id === cleanSongName);
    if (existingSongIndex >= 0) {
      songs[existingSongIndex] = {
        id: cleanSongName,
        title: songName.toUpperCase(),
        bpm: 120,
        difficulty: 'Medium'
      };
    } else {
      // Add new song to index
      songs.push({
        id: cleanSongName,
        title: songName.toUpperCase(),
        bpm: 120,
        difficulty: 'Medium'
      });
    }

    // Write updated index.json
    await fs.writeFile(indexJsonPath, JSON.stringify(songs, null, 2));

    res.json({ 
      success: true, 
      song: {
        id: cleanSongName,
        title: songName.toUpperCase(),
        bpm: 120,
        difficulty: 'Medium'
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload song' });
  }
});


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
 console.log(`Server running on port ${PORT}`);
 console.log(`Chart generation endpoint: http://localhost:${PORT}/api/generate-chart`);
 console.log(`Using Gemini Pro API: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
});