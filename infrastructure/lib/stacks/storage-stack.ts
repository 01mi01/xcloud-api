import * as cdk from 'aws-cdk-lib';
import * as s3   from 'aws-cdk-lib/aws-s3';
import * as iam  from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

interface StorageStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

export class StorageStack extends cdk.Stack {
  public readonly bucket:    s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName:        `xcloud-media-${props.envConfig.name}-${this.account}`,
      // Uploaded images are served directly to the browser as <img> src (the
      // media-service returns the object's https://<bucket>.s3... URL), so the
      // objects must be publicly READable. We keep ACLs blocked and grant only
      // s3:GetObject via the bucket policy below — there's no ListBucket grant
      // and keys are unguessable UUIDs, so objects can't be enumerated.
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls:       true,
        ignorePublicAcls:      true,
        blockPublicPolicy:     false,
        restrictPublicBuckets: false,
      }),
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

    // Public read for objects only (GetObject) — lets browsers load the images
    // directly. Scoped to <bucket>/* ; no s3:ListBucket, so the bucket can't be
    // enumerated.
    this.bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid:        'PublicReadGetObject',
      effect:     iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions:    ['s3:GetObject'],
      resources:  [this.bucket.arnForObjects('*')],
    }));

    new cdk.CfnOutput(this, 'BucketName', { value: this.bucket.bucketName });
  }
}
