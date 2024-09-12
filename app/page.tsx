'use client';

import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
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

  const invokeStateMachines = async () => {
    console.log('Invoking both State Machines');
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
      // After invoking, immediately poll for results
      pollStateMachines();
    } catch (error) {
      console.error('Error invoking state machines:', error);
    }
  };

  const pollStateMachines = async () => {
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
    }
  };

  useEffect(() => {
    const pollInterval = setInterval(() => {
      pollStateMachines();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Step Functions Comparison</h1>
      <div className="w-full max-w-4xl mb-8">
        <button
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
          onClick={invokeStateMachines}
        >
          Invoke Both State Machines
        </button>
      </div>
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl p-6">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
