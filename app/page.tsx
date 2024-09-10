'use client';

const apiUrl = process.env.NEXT_PUBLIC_LAMBDA_URL!;

import { useState, useEffect } from 'react';

export default function Home() {
  const [expressResult, setExpressResult] = useState<string | null>(null);
  const [standardResult, setStandardResult] = useState<string | null>(null);

  const invokeStateMachine = async (type: 'EXPRESS' | 'STANDARD') => {
    console.log(`Invoking State Machine: ${type}`);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'start',
          stateMachine: type,
        }),
      });
      const data = await response.json();
      if (type === 'EXPRESS') {
        setExpressResult(JSON.stringify(data, null, 2));
      } else {
        setStandardResult(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('Error invoking state machine:', error);
      if (type === 'EXPRESS') {
        setExpressResult('Error invoking state machine');
      } else {
        setStandardResult('Error invoking state machine');
      }
    }
  };

  const pollStateMachine = async (type: 'EXPRESS' | 'STANDARD') => {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'list',
          stateMachine: type,
        }),
      });
      const data = await response.json();
      if (type === 'EXPRESS') {
        setExpressResult(JSON.stringify(data, null, 2));
      } else {
        setStandardResult(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('Error polling state machine:', error);
    }
  };

  useEffect(() => {
    const pollInterval = setInterval(() => {
      pollStateMachine('EXPRESS');
      pollStateMachine('STANDARD');
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Step Functions Example</h1>
      <div className="space-x-4 mb-4">
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => invokeStateMachine('EXPRESS')}
        >
          Invoke EXPRESS
        </button>
        <button
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => invokeStateMachine('STANDARD')}
        >
          Invoke STANDARD
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-bold mb-2">EXPRESS Results</h2>
          {expressResult && (
            <pre className="p-4 rounded">
              <code>{expressResult}</code>
            </pre>
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">STANDARD Results</h2>
          {standardResult && (
            <pre className="p-4 rounded">
              <code>{standardResult}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
