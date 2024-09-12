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
  const cmd = payload.cmd;

  const expressStateMachineArn = process.env.EXPRESS_STATE_MACHINE_ARN;
  const standardStateMachineArn = process.env.STANDARD_STATE_MACHINE_ARN;

  if (!expressStateMachineArn || !standardStateMachineArn) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'State machine ARNs not found in environment variables.' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  try {
    if (cmd === 'start') {
      const startExpressExecutionCommand = new StartExecutionCommand({
        stateMachineArn: expressStateMachineArn,
        input: JSON.stringify(payload),
      });

      const startStandardExecutionCommand = new StartExecutionCommand({
        stateMachineArn: standardStateMachineArn,
        input: JSON.stringify(payload),
      });

      console.info(`Both state machines started`);

      const [expressExecution, standardExecution] = await Promise.all([
        sfnClient.send(startExpressExecutionCommand),
        sfnClient.send(startStandardExecutionCommand),
      ]);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Both state machines have started their executions',
          expressExecutionArn: expressExecution.executionArn,
          standardExecutionArn: standardExecution.executionArn,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    } else if (cmd === 'list') {
      const expressDurations = await getExpressDurations();

      const listStandardExecutionsCommand = new ListExecutionsCommand({
        stateMachineArn: standardStateMachineArn,
        maxResults: 10,
      });

      const { executions } = await sfnClient.send(listStandardExecutionsCommand);

      const standardDurations = executions.map((execution: any) => {
        const startDate = new Date(execution.startDate);
        const stopDate = execution.stopDate ? new Date(execution.stopDate) : new Date();
        return stopDate.getTime() - startDate.getTime();
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Last 10 execution durations retrieved for both state machines',
          durationsExpress: expressDurations,
          durationsStandard: standardDurations,
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
