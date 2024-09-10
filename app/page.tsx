'use client';

const apiUrl = process.env.NEXT_PUBLIC_LAMBDA_URL!;

import { useState } from 'react';

export default function Home() {
  const [result, setResult] = useState<string | null>(null);

  const invokeStateMachine = async (type: 'EXPRESS' | 'STANDARD') => {
    console.log(`Invoking State Machine: ${type}`);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stateMachine: type }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error invoking state machine:', error);
      setResult('Error invoking state machine');
    }
  };

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
      {result && (
        <pre className="p-4 rounded">
          <code>{result}</code>
        </pre>
      )}
    </div>
  );
}
