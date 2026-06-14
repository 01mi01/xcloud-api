import * as cdk from 'aws-cdk-lib';
import * as s3   from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

interface StorageStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

export class StorageStack extends cdk.Stack {
  public readonly bucket:    s3.Bucket;
  public readonly webBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName:        `xcloud-media-${props.envConfig.name}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,
      versioned:         false,
      removalPolicy:     props.envConfig.deletionProtection
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.envConfig.deletionProtection,
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedHeaders: ['*'],
          maxAge:         3000,
        },
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    // Separate bucket for the React SPA static assets (HTML, JS, CSS).
    // CloudFront accesses it via OAC — no public access needed.
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName:        `xcloud-web-${props.envConfig.name}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,
      versioned:         false,
      removalPolicy:     cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new cdk.CfnOutput(this, 'BucketName',    { value: this.bucket.bucketName });
    new cdk.CfnOutput(this, 'WebBucketName', { value: this.webBucket.bucketName });
  }
}
