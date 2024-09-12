'use client';

import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import Image from 'next/image';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const apiUrl = process.env.NEXT_PUBLIC_LAMBDA_URL!;

export default function Home() {
  const [results, setResults] = useState<{ express: number[]; standard: number[] }>({
    express: [],
    standard: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const invokeStateMachines = async () => {
    console.log('Invoking both State Machines');
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'start',
        }),
      });
      const data = await response.json();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000); // Hide toast after 3 seconds
      // After invoking, immediately poll for results
      pollStateMachines();
    } catch (error) {
      console.error('Error invoking state machines:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pollStateMachines = async () => {
    setIsPolling(true);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'list',
        }),
      });
      const data = await response.json();
      setResults({
        express: data.durationsExpress || [],
        standard: data.durationsStandard || [],
      });
    } catch (error) {
      console.error('Error polling state machines:', error);
    } finally {
      setIsPolling(false);
    }
  };

  useEffect(() => {
    // Initial poll when the page loads
    pollStateMachines();

    const pollInterval = setInterval(() => {
      pollStateMachines();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  const calculateAverage = (durations: number[]) => {
    if (durations.length === 0) return 0;
    const sum = durations.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / durations.length);
  };

  const expressAverage = calculateAverage(results.express);
  const standardAverage = calculateAverage(results.standard);

  const chartData = {
    labels: results.express.map((_, index) => `Execution ${index + 1}`),
    datasets: [
      {
        label: 'EXPRESS',
        data: results.express,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: 'STANDARD',
        data: results.standard,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'State Machine Execution Durations',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Duration (ms)',
        },
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Image 
        src="/images/step-functions.svg" 
        alt="Step Functions Logo" 
        width={80} 
        height={80} 
        className="mb-4 rounded-full shadow-md"
      />
      <h1 className="text-4xl font-extrabold mb-8 text-[#EE417E] tracking-tight">Step Functions Comparison</h1>
      <div className="w-full max-w-3xl mb-8">
        <button
          className={`w-full ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-semibold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-102 shadow-md`}
          onClick={invokeStateMachines}
          disabled={isLoading}
        >
          {isLoading ? 'Invoking...' : 'Invoke Both State Machines'}
        </button>
      </div>
      {showToast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg transition-opacity duration-300">
          State machines have been successfully invoked!
        </div>
      )}
      <p className="text-sm text-gray-600 mb-6 max-w-2xl text-center leading-relaxed">
        Note: Results for Express executions are queried via Log Insights and may take some time to display. The UI refreshes every 5 seconds.
      </p>
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-6 relative">
        {isPolling && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span>Updating...</span>
          </div>
        )}
        <div className="mb-4 flex justify-between text-sm font-medium">
          <span className="text-blue-600"><strong>EXPRESS</strong> ø: {expressAverage} ms</span>
          <span className="text-purple-600"><strong>STANDARD</strong> ø: {standardAverage} ms</span>
        </div>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
