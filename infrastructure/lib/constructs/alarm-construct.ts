import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions     from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns         from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface AlarmConstructProps {
  /** Email address that receives alarm notifications. */
  alertEmail: string;
}

export class AlarmConstruct extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlarmConstructProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, 'AlertTopic', {
      displayName: 'xcloud-alerts',
    });

    this.topic.addSubscription(
      new subscriptions.EmailSubscription(props.alertEmail),
    );
  }

  /** Convenience helper — creates a metric alarm wired to the SNS topic. */
  addAlarm(
    id: string,
    metric: cloudwatch.IMetric,
    opts: { threshold: number; evaluationPeriods: number; alarmDescription: string },
  ): cloudwatch.Alarm {
    const alarm = new cloudwatch.Alarm(this, id, {
      metric,
      threshold:         opts.threshold,
      evaluationPeriods: opts.evaluationPeriods,
      alarmDescription:  opts.alarmDescription,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData:   cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarm.addAlarmAction(new actions.SnsAction(this.topic));
    return alarm;
  }
}
