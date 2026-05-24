import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { SqsConstruct } from '../constructs/sqs-construct';

interface MessagingStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

export class MessagingStack extends cdk.Stack {
  public readonly sqs: SqsConstruct;

  constructor(scope: Construct, id: string, props: MessagingStackProps) {
    super(scope, id, props);

    this.sqs = new SqsConstruct(this, 'Sqs');

    new cdk.CfnOutput(this, 'TweetCreatedQueueUrl', { value: this.sqs.tweetCreated.queueUrl });
    new cdk.CfnOutput(this, 'TweetIndexQueueUrl',   { value: this.sqs.tweetIndex.queueUrl   });
    new cdk.CfnOutput(this, 'LikeEventQueueUrl',    { value: this.sqs.likeEvent.queueUrl    });
    new cdk.CfnOutput(this, 'FollowEventQueueUrl',  { value: this.sqs.followEvent.queueUrl  });
  }
}
