import * as cdk         from 'aws-cdk-lib';
import * as cloudfront  from 'aws-cdk-lib/aws-cloudfront';
import * as origins     from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2       from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { StorageStack } from './storage-stack';

interface CdnStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  storage:   StorageStack;
  alb:       elbv2.ApplicationLoadBalancer;
}

export class CdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    // CloudFront Function: strip /api prefix before forwarding to ALB.
    // /api/v1/auth/login → /v1/auth/login (matches ALB listener rules /v1/auth*)
    const stripApiPrefix = new cloudfront.Function(this, 'StripApiPrefix', {
      functionName: `xcloud-strip-api-prefix-${props.envConfig.name}`,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\\/api/, '');
  return request;
}
      `),
    });

    // API origin — ALB serving all /v1/* routes via HTTP (beta is HTTP-only)
    const apiOrigin = new origins.LoadBalancerV2Origin(props.alb, {
      protocolPolicy:      cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      connectionAttempts:  3,
      connectionTimeout:   cdk.Duration.seconds(5),
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      // Default behavior — React SPA from S3 web bucket
      defaultBehavior: {
        origin:               new origins.S3Origin(props.storage.webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:          cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods:       cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        // All API calls routed to the ALB, never cached
        // Use AWS managed CachingDisabled policy (TTL=0, no header restrictions)
        '/api/*': {
          origin:               apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
          cachePolicy:          cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods:       cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:  cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [{
            function:  stripApiPrefix,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
      },
      defaultRootObject: 'index.html',
      // SPA fallback — React Router handles client-side routing
      errorResponses: [
        {
          httpStatus:         403,
          responseHttpStatus: 200,
          responsePagePath:   '/index.html',
          ttl:                cdk.Duration.seconds(0),
        },
        {
          httpStatus:         404,
          responseHttpStatus: 200,
          responsePagePath:   '/index.html',
          ttl:                cdk.Duration.seconds(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront URL — use this as the app entry point',
    });

    new cdk.CfnOutput(this, 'WebBucketName', {
      value: props.storage.webBucket.bucketName,
      description: 'S3 bucket — deploy frontend with: aws s3 sync dist/ s3://<this-value>',
    });
  }
}
