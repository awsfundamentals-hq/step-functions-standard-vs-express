'use client';

const apiUrl = process.env.NEXT_PUBLIC_LAMBDA_URL!;

import { useState, useEffect } from 'react';

export default function Home() {
  const [results, setResults] = useState<{ express: string | null; standard: string | null }>({
    express: null,
    standard: null,
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
      setResults({
        express: JSON.stringify(data, null, 2),
        standard: JSON.stringify(data, null, 2),
      });
    } catch (error) {
      console.error('Error invoking state machines:', error);
      setResults({
        express: 'Error invoking state machines',
        standard: 'Error invoking state machines',
      });
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
        express: JSON.stringify({ durationsExpress: data.durationsExpress }, null, 2),
        standard: JSON.stringify({ durationsStandard: data.durationsStandard }, null, 2),
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

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Step Functions Example</h1>
      <div className="space-x-4 mb-4">
        <button
          className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          onClick={invokeStateMachines}
        >
          Invoke Both State Machines
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-bold mb-2">EXPRESS Results</h2>
          {results.express && (
            <pre className="p-4 rounded">
              <code>{results.express}</code>
            </pre>
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">STANDARD Results</h2>
          {results.standard && (
            <pre className="p-4 rounded">
              <code>{results.standard}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
