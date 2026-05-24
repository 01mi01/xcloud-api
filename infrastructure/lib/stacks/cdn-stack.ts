import * as cdk         from 'aws-cdk-lib';
import * as cloudfront  from 'aws-cdk-lib/aws-cloudfront';
import * as origins     from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { StorageStack } from './storage-stack';

interface CdnStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  storage:   StorageStack;
}

export class CdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(props.storage.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:          cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods:       cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      defaultRootObject: 'index.html',
      // SPA fallback — return index.html for any 403/404 so React Router handles routing
      errorResponses: [
        {
          httpStatus:          403,
          responseHttpStatus:  200,
          responsePagePath:    '/index.html',
          ttl:                 cdk.Duration.seconds(0),
        },
        {
          httpStatus:          404,
          responseHttpStatus:  200,
          responsePagePath:    '/index.html',
          ttl:                 cdk.Duration.seconds(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US + Europe only
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
    });
  }
}
