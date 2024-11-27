

import React, { useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { Line } from 'react-chartjs-2';
import axios from 'axios';
import Skeleton from '@mui/material/Skeleton';
import './SentimentChart.css';

// Chart.js registration
ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler);

const SentimentChart = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [pieChartData, setPieChartData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false); // Loading state
  const [lineAnalysis, setLineAnalysis] = useState(null);
  const [pieAnalysis, setPieAnalysis] = useState(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setSummary(null);
    setChartData(null);
    setPieChartData(null);
    setAiAnalysis(null);
    setLineAnalysis(null);
    setPieAnalysis(null);

    try {
      console.log("react app url for backend",process.env.REACT_APP_API_URL )
      const response = await axios.post(`https://assemblyaibackend.vercel.app/transcribe`, { videoUrl });
      const { summaryData, sentimentData, aiAnalysisData, lineChartAnalysis, pieChartAnalysis } = response.data;

      if (summaryData) setSummary(summaryData);
      if (aiAnalysisData) setAiAnalysis(aiAnalysisData);

      if (sentimentData) {
        const timestamps = sentimentData.map((data) => data.timestamp);
        const scores = sentimentData.map((data) => data.score);

        // Line Chart Data
        setChartData({
          labels: timestamps,
          datasets: [
            {
              label: 'Sentiment Score Over Time',
              data: scores,
              borderColor: 'rgba(75, 192, 192, 1)',
              backgroundColor: scores.map(score => 
                score >= 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)'
              ),
              pointBackgroundColor: scores.map(score => 
                score >= 0 ? 'rgba(144, 238, 144, 1)' : 'rgba(255, 182, 193, 1)'
              ),
              pointBorderColor: scores.map(score => 
                score >= 0 ? 'rgba(144, 238, 144, 1)' : 'rgba(255, 182, 193, 1)'
              ),
              fill: false,
              pointRadius: 5,
            },
          ],
        });

        // Pie Chart Data
        const positiveScores = scores.filter(score => score > 0).length;
        const negativeScores = scores.filter(score => score < 0).length;
        const neutralScores = scores.filter(score => score === 0).length;
        const totalScores = scores.length;

        setPieChartData({
          labels: ['Positive', 'Negative', 'Neutral'],
          datasets: [
            {
              data: [
                ((positiveScores / totalScores) * 100).toFixed(2),
                ((negativeScores / totalScores) * 100).toFixed(2),
                ((neutralScores / totalScores) * 100).toFixed(2)
              ],
              backgroundColor: ['rgba(144, 238, 144, 0.6)', 'rgba(255, 182, 193, 0.6)', 'rgba(128, 128, 128, 0.6)'],
              borderColor: ['rgba(144, 238, 144, 1)', 'rgba(255, 182, 193, 1)', 'rgba(128, 128, 128, 1)'],
              borderWidth: 1,
            },
          ],
        });
      }

      if (lineChartAnalysis) setLineAnalysis(lineChartAnalysis);
      if (pieChartAnalysis) setPieAnalysis(pieChartAnalysis);
    } catch (error) {
      console.error('Error analyzing video:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sentimentChart">
      <h1>Sentiment Analysis Visualization</h1>
      <div className="sentimentChart__videoUrlInput">
        <input
          type="text"
          placeholder="Enter video URL"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <button onClick={handleAnalyze} disabled={loading}>Analyze</button>
      </div>

      {loading && (
        <div className="sentimentChart__loading">
          <Skeleton variant="rectangular" width={250} height={118} />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
          <p>Processing request, please wait...</p>
        </div>
      )}

      {summary && <div className="sentimentChart__summary"><b>Summary:</b> {summary}</div>}

 
      {chartData && (
        <div className="sentimentChart__linechart">

          <Line 
            className="sentimentChart__linechart-chart"
            data={chartData} 
            options={{
              scales: { 
                x: { title: { display: true, text: 'Time (seconds)' } }, 
                y: { title: { display: true, text: 'Sentiment Score' } } 
              },
              plugins: { 
                tooltip: { 
                  callbacks: { 
                    label: context => `Sentiment Score: ${context.parsed.y}` 
                  } 
                } 
              },
            }} 
          />
          {lineAnalysis && lineAnalysis.length > 0 && (
            <div className="sentimentChart__lineAnalysis">
              <h3>Line Chart Analysis - Sentiment Progression Over Time</h3>

              {lineAnalysis.map((section, index) => (
                <div key={index} className="sentimentChart__section">
                  {section.title && (
                    <p className="sentimentChart__sectionTitle">{section.title}</p>
                  )}
                  {section.bulletPoints && section.bulletPoints.length > 0 && (
                    <ul className="sentimentChart__bulletPoints">
                      {section.bulletPoints
                        .filter(point => point !== undefined)
                        .map((point, idx) => (
                          <li key={idx} className="sentimentChart__bulletPoint">
                            {point}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {pieChartData && (
          <div className="sentimentChart__piechart">
          <div className="sentimentChart__piechart-chart-wrapper">
  
          <Pie 
            className="sentimentChart__piechart-chart" 
            data={pieChartData} 
            options={{
              plugins: { 
                legend: { position: 'top' }, 
                tooltip: { callbacks: { label: context => `${context.label}: ${context.parsed}%` } } 
              },
          }} />
          </div>
          {pieAnalysis && pieAnalysis.length > 0 && (
            <div className="sentimentChart__pieAnalysis">
              <h3>Pie Chart Analysis - Overall Sentiment Distribution</h3>

              {pieAnalysis.map((section, index) => (
                <div key={index} className="sentimentChart__section">
                  {section.title && (
                    <p className="sentimentChart__sectionTitle">{section.title}</p>
                  )}
                  {section.bulletPoints && section.bulletPoints.length > 0 && (
                    <ul className="sentimentChart__bulletPoints">
                      {section.bulletPoints
                        .filter(point => point !== undefined)
                        .map((point, idx) => (
                          <li key={idx} className="sentimentChart__bulletPoint">
                            {point}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {aiAnalysis && (
        <div className="sentimentChart__aiAnalysis">
          {aiAnalysis.map((section, idx) => (
            <div className='sentimentChart__aiAnalysis-section' key={idx}>
              <h2>{idx + 1}. {section.title}</h2>
              {section.subsections.map((sub, subIdx) => (
                <div className='sentimentChart__aiAnalysis-subsection' key={subIdx}>
                  <h3>{String.fromCharCode(97 + subIdx)}. {sub.subtitle}</h3>
                  <ul>{sub.points.map((point, pIdx) => <li key={pIdx}>{point}</li>)}</ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SentimentChart;










