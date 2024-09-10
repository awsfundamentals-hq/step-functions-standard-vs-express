import { CloudWatchLogsClient, GetQueryResultsCommand, StartQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
const { SFNClient, StartExecutionCommand, ListExecutionsCommand } = require('@aws-sdk/client-sfn');

const sfnClient = new SFNClient();

const client = new CloudWatchLogsClient();

async function getExpressDurations(): Promise<number[]> {
  try {
    const command = new StartQueryCommand({
      logGroupName: `/aws/vendedlogs/states/express-state-machine`,
      startTime: Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000),
      endTime: Math.floor(Date.now() / 1000),
      queryString: `
        fields @timestamp, execution_arn, id, event_timestamp
        | stats min(event_timestamp) as start_time, max(event_timestamp) as end_time by execution_arn
        | sort end_time desc
        | limit 10
        | display (end_time - start_time) as duration_milliseconds
      `,
    });

    const response = await client.send(command);

    console.info(JSON.stringify(response, null, 2));

    // Wait for the query to complete
    const queryId = response.queryId;
    let queryStatus;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
      const getQueryResultsCommand = new GetQueryResultsCommand({ queryId });
      const queryResults = await client.send(getQueryResultsCommand);
      queryStatus = queryResults.status;
    } while (queryStatus === 'Running' || queryStatus === 'Scheduled');

    if (queryStatus === 'Complete') {
      const getQueryResultsCommand = new GetQueryResultsCommand({ queryId });
      const queryResults = await client.send(getQueryResultsCommand);
      console.info(JSON.stringify(queryResults, null, 2));
      return queryResults.results?.map(([{ value: duration }]) => Number(duration)) ?? [];
    } else {
      console.error('Query failed with status:', queryStatus);
      return [];
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const payload = JSON.parse(event.body || '{}');
  const stateMachineType = payload.stateMachine;
  const cmd = payload.cmd;

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
    if (cmd === 'start') {
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
    } else if (cmd === 'list') {
      let durations: number[] = [];
      if (stateMachineType === 'EXPRESS') {
        durations = await getExpressDurations();
      } else {
        const listExecutionsCommand = new ListExecutionsCommand({
          stateMachineArn,
          maxResults: 10,
        });

        const { executions } = await sfnClient.send(listExecutionsCommand);

        durations = executions.map((execution: any) => {
          const startDate = new Date(execution.startDate);
          const stopDate = execution.stopDate ? new Date(execution.stopDate) : new Date();
          return stopDate.getTime() - startDate.getTime();
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Last 10 execution durations retrieved',
          durations,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid command. Must be "start" or "list".' }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing request' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};
