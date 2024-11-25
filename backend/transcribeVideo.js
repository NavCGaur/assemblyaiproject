import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import axios from 'axios';
import { AssemblyAI } from 'assemblyai';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

// Convert exec to promise
const exec = promisify(execCallback);

// Environment checks
if (!process.env.ASSEMBLYAI_API_KEY) {
  throw new Error('Missing required ASSEMBLYAI_API_KEY in environment variables.');
}

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });



// AssemblyAI Client
const formatAiAnalysis = (response) => {
  if (!response) return [];

  // Helper function to clean text
  const cleanText = (text) => text.trim().replace(/^\*\*|\*\*$/g, '');

  // Split into main sections and remove empty ones
  const sections = response
    .split(/(?=\d+\.\s+(?:\*\*)?[^*\n]+(?:\*\*)?)/g)
    .filter(section => section.trim())
    // Remove duplicate sections by comparing cleaned content
    .filter((section, index, array) => {
      const cleanedSection = cleanText(section);
      return array.findIndex(s => cleanText(s) === cleanedSection) === index;
    });

  return sections.map(section => {
    // Extract main title with more flexible pattern matching
    const titleMatch = section.match(/\d+\.\s*(?:\*\*)?([^*\n]+)(?:\*\*)?/);
    if (!titleMatch) return null;

    const mainTitle = cleanText(titleMatch[1]);
    const contentAfterTitle = section.slice(section.indexOf(titleMatch[0]) + titleMatch[0].length);
    
    // Process subsections with improved handling
    const subsections = [];
    let currentSubsection = null;
    
    const lines = contentAfterTitle
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    
    lines.forEach(line => {
      // Improved subsection header detection
      const subsectionMatch = line.match(/^([a-z])\.\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?(?::|$)/i);
      
      if (subsectionMatch) {
        if (currentSubsection) {
          subsections.push(currentSubsection);
        }
        
        currentSubsection = {
          subtitle: cleanText(subsectionMatch[2]),
          points: []
        };
      } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        // Handle all common bullet point styles
        if (currentSubsection) {
          const point = line.slice(1).trim();
          if (point && !currentSubsection.points.includes(point)) {
            currentSubsection.points.push(point);
          }
        }
      } else if (line.match(/^\d+\./)) {
        // Handle numbered points
        if (currentSubsection) {
          const point = line.replace(/^\d+\.\s*/, '').trim();
          if (point && !currentSubsection.points.includes(point)) {
            currentSubsection.points.push(point);
          }
        }
      } else if (currentSubsection && line) {
        // Handle continuation lines and prevent duplicates
        if (!currentSubsection.points.includes(line)) {
          currentSubsection.points.push(line);
        }
      }
    });
    
    // Add the last subsection if it exists
    if (currentSubsection) {
      subsections.push(currentSubsection);
    }

    // Remove duplicate subsections
    const uniqueSubsections = subsections.filter((sub, index, array) => 
      array.findIndex(s => s.subtitle === sub.subtitle) === index
    );

    return {
      title: mainTitle,
      subsections: uniqueSubsections.filter(sub => 
        sub.subtitle && (sub.points.length > 0 || sub.subtitle)
      )
    };
  }).filter(section => section !== null);
};


const formatChartAnalysis = (chartResponse) => {
  // Helper function to parse content
  const parseContent = (content) => {
    if (!content) return [];

    // Split content by subsections (a., b., c., etc.)
    const subsections = content.split(/(?:\n\s*[a-z]\.\s+)/);
    
    // First item is the title/header
    const title = subsections[0].trim();
    
    // Rest are bullet points
    const bulletPoints = subsections
      .slice(1)
      .map(point => point.trim())
      .filter(point => point && point !== 'undefined');

    return [{
      title,
      bulletPoints
    }];
  };

  // Extract sections
  const lineChartMatch = chartResponse.match(/\*\*Line Chart Analysis\*\*:([\s\S]*?)(?=\*\*Pie Chart Analysis|$)/i);
  const pieChartMatch = chartResponse.match(/\*\*Pie Chart Analysis\*\*:([\s\S]*?)$/i);

  return {
    lineChartAnalysis: lineChartMatch ? parseContent(lineChartMatch[1]) : [],
    pieChartAnalysis: pieChartMatch ? parseContent(pieChartMatch[1]) : []
  };
};





// Transcribes a video URL and generates tailored analysis using LeMUR and Claude. //
export async function transcribeVideo(videoUrl) {
  try {
    console.log('Starting transcription and analysis for:', videoUrl);

    // 1. Extract audio URL
    const { stdout: audioUrl } = await exec(`yt-dlp -f bestaudio --audio-quality 5 -g "${videoUrl}"`);
    const directUrl = audioUrl.trim();
    console.log('Got audio URL');

    // 2. Stream audio to AssemblyAI
    const uploadResponse = await axios({
      method: 'post',
      url: 'https://api.assemblyai.com/v2/upload',
      headers: {
        Authorization: process.env.ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      data: (await axios.get(directUrl, { responseType: 'stream' })).data,
    });
    const { upload_url } = uploadResponse.data;

    console.log('Uploaded audio to AssemblyAI');

    // 3. Start transcription
    const transcript = await client.transcripts.transcribe({
      audio_url: upload_url,
      language_code: 'en',
      summarization: true,
      summary_model: 'informative',
      summary_type: 'bullets_verbose',
      sentiment_analysis: true,
    });
    console.log('Transcription started, ID:', transcript.id);

    // 4. Wait for transcription results
    let transcriptionResult;
    while (true) {
      const result = await client.transcripts.get(transcript.id);
      if (result.status === 'completed') {
        transcriptionResult = result;
        console.log('Transcription completed');
        break;
      } else if (result.status === 'error') {
        throw new Error(`Transcription error: ${result.error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Poll every 3 seconds
    }

    // 5. Define a detailed prompt for analysis
    const prompt = `Based on the transcription of the audio, provide a detailed analysis in the following structured format:

                  1. **Purpose and Context**  
                    a. Summarize the main objective or goal of the individuals involved.  
                    b. Describe the broader context of the discussion or content.  

                  2. **Analysis and Feedback**  
                    a. Offer constructive feedback on key strengths related to the purpose or goal.  
                    b. Identify specific areas for improvement.  

                  3. **Actionable Recommendations for improvement**  
                    a. Provide clear and specific recommendations for improvement.  

                  4. **Improvement and Prevention Strategies**  
                    a. Recommend strategies to sustain improvements.  
                    b. Propose methods to prevent potential issues in similar contexts.  

                  Ensure:
                  - Each section and subpoint is clearly labeled (e.g., "1. **Purpose and Context**, a., b.").  
                  - Bullet points are separated by newlines for proper formatting.  
                  - The response adheres strictly to markdown style for easy frontend rendering.  


                `;

    console.log('Prompt defined for analysisLeMUR task');


    const chartPrompt = `Identify the content type (e.g., educational, motivational, discussion, entertainment). 
Analyze the sentiment of the provided transcription. Based on the inferred content type, provide:

**Line Chart Analysis**:
a. Overall sentiment progression pattern
b. Key emotional transitions
c. Notable temporal patterns

**Pie Chart Analysis**:
a. Distribution breakdown
b. Dominant sentiment patterns
c. Content type correlation

Ensure each point is clear and separated by newlines.`;

                console.log('Prompt defined for Chart LeMUR task');


    // 6. Use LeMUR Task with Claude for analysis
    const { response: analysisResponse } = await client.lemur.task({
      transcript_ids: [transcriptionResult.id],
      prompt,
      final_model: 'anthropic/claude-3-5-sonnet',
    });

    const { response: chartResponse } = await client.lemur.task({
      transcript_ids: [transcriptionResult.id],
      prompt:chartPrompt,
      final_model: 'anthropic/claude-3-5-sonnet',
    });


    const formattedResponse = formatAiAnalysis(analysisResponse);
    const { lineChartAnalysis, pieChartAnalysis } = formatChartAnalysis(chartResponse);
    


    // 7. Return combined transcription and analysis
    return {
      transcription: transcriptionResult,
      analysis: formattedResponse,
      lineChartAnalysis,
      pieChartAnalysis ,
    };
    
  } catch (error) {
    console.error('Error in transcription and analysis:', error);
    throw error;
  }
}
