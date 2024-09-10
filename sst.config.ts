/// <reference path="./.sst/platform/config.d.ts" />

import * as aws from '@pulumi/aws';
import { Function } from './.sst/platform/src/components/aws/function';
import { Nextjs } from './.sst/platform/src/components/aws/nextjs';

const createStateMachine = (type: 'EXPRESS' | 'STANDARD') => {
  const lambdaFunction = new Function(`stateMachineLambda-${type.toLowerCase()}`, {
    handler: 'lambda/step-function.handler',
  });

  const stepFunctionRole = new aws.iam.Role(`stepFunctionRole-${type.toLowerCase()}`, {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'states.amazonaws.com',
          },
        },
      ],
    }),
  });

  new aws.iam.RolePolicy(`stepFunctionPolicy-${type.toLowerCase()}`, {
    role: stepFunctionRole.id,
    policy: lambdaFunction.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'lambda:InvokeFunction',
            Resource: arn,
          },
        ],
      }),
    ),
  });

  const logGroup = new aws.cloudwatch.LogGroup(`stateMachineLogGroup-${type.toLowerCase()}`, {
    name: `/aws/vendedlogs/states/${type.toLowerCase()}-state-machine`,
    retentionInDays: 14,
  });

  new aws.iam.RolePolicy(`stepFunctionLoggingPolicy-${type.toLowerCase()}`, {
    role: stepFunctionRole.id,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'logs:CreateLogDelivery',
            'logs:GetLogDelivery',
            'logs:UpdateLogDelivery',
            'logs:DeleteLogDelivery',
            'logs:ListLogDeliveries',
            'logs:PutLogEvents',
            'logs:PutResourcePolicy',
            'logs:DescribeResourcePolicies',
            'logs:DescribeLogGroups',
          ],
          Resource: '*',
        },
      ],
    }),
  });

  new aws.cloudwatch.LogResourcePolicy(`stepFunctionLogResourcePolicy-${type.toLowerCase()}`, {
    policyName: `stepFunctionLogResourcePolicy-${type.toLowerCase()}`,
    policyDocument: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'states.amazonaws.com',
          },
          Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
          Resource: `${logGroup.arn}:*`,
        },
      ],
    }),
  });

  const stateMachine = new aws.sfn.StateMachine(`stateMachine-${type.toLowerCase()}`, {
    definition: lambdaFunction.arn.apply((arn) =>
      JSON.stringify({
        StartAt: 'InvokeLambda',
        States: {
          InvokeLambda: {
            Type: 'Task',
            Resource: 'arn:aws:states:::lambda:invoke',
            Parameters: {
              FunctionName: arn,
              Payload: {
                'Input.$': '$',
              },
            },
            End: true,
          },
        },
      }),
    ),
    type: type,
    roleArn: stepFunctionRole.arn,
    loggingConfiguration: {
      includeExecutionData: true,
      level: 'ALL',
      logDestination: logGroup.arn.apply((arn) => `${arn}:*`),
    },
  });

  return stateMachine;
};

export default $config({
  app(input) {
    return {
      name: 'step-functions-standard-vs-express',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    };
  },
  async run() {
    const expressStateMachine = createStateMachine('EXPRESS');
    const standardStateMachine = createStateMachine('STANDARD');

    const starter = new Function('api', {
      handler: 'lambda/starter.handler',
      url: true,
      environment: {
        EXPRESS_STATE_MACHINE_ARN: expressStateMachine.arn,
        STANDARD_STATE_MACHINE_ARN: standardStateMachine.arn,
      },
      permissions: [
        {
          actions: ['states:StartExecution', 'states:DescribeExecution'],
          resources: [expressStateMachine.arn, standardStateMachine.arn],
        },
      ],
    });

    const frontend = new Nextjs('frontend', {
      environment: {
        NEXT_PUBLIC_LAMBDA_URL: starter.url,
      },
    });

    return {
      apiUrl: starter.url,
      frontendUrl: frontend.url,
    };
  },
});
