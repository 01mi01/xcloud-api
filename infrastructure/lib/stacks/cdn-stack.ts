import * as cdk         from 'aws-cdk-lib';
import * as cloudfront  from 'aws-cdk-lib/aws-cloudfront';
import * as origins     from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3          from 'aws-cdk-lib/aws-s3';
import * as elbv2       from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

interface CdnStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  /** The application load balancer (gateway stack) — origin for /api/*. */
  alb:       elbv2.IApplicationLoadBalancer;
}

/**
 * Hosts the React SPA on CloudFront + a private S3 bucket, and routes API
 * traffic through the SAME CloudFront domain to the ALB:
 *
 *   viewer ──HTTPS──▶ CloudFront ──┬─ default  ─▶ S3 (apps/web/dist)
 *                                  └─ /api/*    ─▶ ALB (HTTP origin)
 *
 * Routing /api/* through CloudFront (rather than the SPA calling the ALB
 * directly) avoids two problems on beta: the ALB is HTTP-only (mixed-content
 * blocked from an HTTPS page) and cross-origin CORS. A CloudFront Function
 * strips the /api prefix so the ALB sees its real paths (/v1/tweets, …).
 *
 * Build the SPA first: `npm run build -w apps/web` (defaults VITE_API_BASE_URL
 * to "/api", which is exactly what the /api/* behaviour expects).
 *
 * The built files are uploaded out-of-band via the CLI (see the WebBucketName /
 * DistributionId outputs), NOT via s3-deployment's BucketDeployment — its custom
 * resource bundles an awscli whose Python-union syntax breaks on CDK 2.150's
 * Lambda runtime under this pinned setup. CLI upload sidesteps that entirely:
 *   aws s3 sync apps/web/dist s3://<WebBucketName> --delete
 *   aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
 */
export class CdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    // Private bucket for the built SPA — only CloudFront (OAI) can read it.
    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,
      removalPolicy:     cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Strip the /api prefix before the request reaches the ALB:
    //   /api/v1/tweets → /v1/tweets   (and /api → /)
    const stripApiPrefix = new cloudfront.Function(this, 'StripApiPrefix', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var req = event.request;
  if (req.uri === '/api' || req.uri === '/api/') { req.uri = '/'; }
  else if (req.uri.indexOf('/api/') === 0) { req.uri = req.uri.substring(4); }
  return req;
}`),
    });

    // The ALB is HTTP-only on beta; CloudFront→origin can speak HTTP even though
    // viewer→CloudFront is HTTPS, so there's no mixed-content problem.
    const apiOrigin = new origins.LoadBalancerV2Origin(props.alb, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin:               new origins.S3Origin(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:          cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods:       cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        // Everything under /api/* is dynamic: no caching, forward the
        // Authorization header + body + query, allow all methods, strip /api.
        '/api/*': {
          origin:               apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods:       cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy:          cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:  cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [{
            function:  stripApiPrefix,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
      },
      defaultRootObject: 'index.html',
      // SPA deep-link fallback. S3 (OAI) returns 403 for a missing key, so map
      // 403 → index.html. We deliberately do NOT remap 404, so real API 404s
      // (e.g. tweet not found) pass through to the SPA as JSON, not index.html.
      errorResponses: [
        {
          httpStatus:         403,
          responseHttpStatus: 200,
          responsePagePath:   '/index.html',
          ttl:                cdk.Duration.seconds(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US + Europe only
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: `https://${this.distribution.distributionDomainName}`,
    });
    // Needed for the out-of-band CLI upload of the built SPA.
    new cdk.CfnOutput(this, 'WebBucketName',  { value: webBucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
  }
}
