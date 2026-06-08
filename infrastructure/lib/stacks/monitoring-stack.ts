import * as cdk        from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { AlarmConstruct } from '../constructs/alarm-construct';
import { SERVICES } from '../config/constants';

interface MonitoringStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const alarms = new AlarmConstruct(this, 'Alarms', {
      alertEmail: 'alerts@xcloud.app',
    });

    // ── CloudWatch Dashboard ───────────────────────────────────────────
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `xcloud-${props.envConfig.name}`,
    });

    const widgets: cloudwatch.IWidget[] = SERVICES.map(svc =>
      new cloudwatch.GraphWidget({
        title:  svc,
        width:  6,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace:  'ECS/ContainerInsights',
            metricName: 'CpuUtilized',
            dimensionsMap: { ServiceName: svc, ClusterName: `xcloud-${props.envConfig.name}` },
            statistic: 'Average',
            period:    cdk.Duration.minutes(1),
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace:  'ECS/ContainerInsights',
            metricName: 'MemoryUtilized',
            dimensionsMap: { ServiceName: svc, ClusterName: `xcloud-${props.envConfig.name}` },
            statistic: 'Average',
            period:    cdk.Duration.minutes(1),
          }),
        ],
      }),
    );

    dashboard.addWidgets(...widgets);

    // ── Critical alarm — 5xx errors on ALB ────────────────────────────
    alarms.addAlarm('Alb5xx', new cloudwatch.Metric({
      namespace:  'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_5XX_Count',
      statistic:  'Sum',
      period:     cdk.Duration.minutes(5),
    }), {
      threshold:         10,
      evaluationPeriods: 2,
      alarmDescription:  'ALB 5xx error rate too high',
    });
  }
}
