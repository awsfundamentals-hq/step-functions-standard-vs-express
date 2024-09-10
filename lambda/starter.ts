import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
const { SFNClient, StartExecutionCommand, DescribeExecutionCommand } = require('@aws-sdk/client-sfn');

const sfnClient = new SFNClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const payload = JSON.parse(event.body || '{}');
  const stateMachineType = payload.stateMachine;

  if (stateMachineType !== 'EXPRESS' && stateMachineType !== 'STANDARD') {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid stateMachine type. Must be EXPRESS or STANDARD.' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  const stateMachineArn = process.env[`${stateMachineType}_STATE_MACHINE_ARN`];

  if (!stateMachineArn) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'State machine ARN not found in environment variables.' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  try {
    const startExecutionCommand = new StartExecutionCommand({
      stateMachineArn,
      input: JSON.stringify(payload),
    });

    console.info(`State machine started`);

    const { executionArn } = await sfnClient.send(startExecutionCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'State machine has started its execution',
        executionArn,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    console.error('Error starting state machine execution:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error starting state machine execution' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};
