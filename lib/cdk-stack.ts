import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { GraphQLServerFargate } from './express-server';
import { VercelIam } from './vercel-iam';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'mysns', {
      bucketName: 'my-sns',
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // const api = new apigw.RestApi(this, 'mysns-api', {
    //   restApiName: 'my-sns-api',
    //   binaryMediaTypes: ['application/octet-stream', 'image/*'],
    // });

    const layer = new lambda.LayerVersion(this, 'image-processing-layer', {
      code: lambda.Code.fromAsset('resources/lambda-layer/image-processing-layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      compatibleArchitectures: [cdk.aws_lambda.Architecture.ARM_64],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // const presignedUrlHandler = new NodejsFunction(this, 'presigned-url-handler', {
    //   functionName: 'presigned-url-handler',
    //   runtime: lambda.Runtime.NODEJS_20_X,
    //   architecture: cdk.aws_lambda.Architecture.ARM_64,
    //   entry: './resources/lambda/presigned-url-handler.ts',
    //   handler: 'handler',
    //   environment: {
    //     BUCKET_NAME: bucket.bucketName,
    //   },
    // });

    const resizeFileHandler = new NodejsFunction(this, 'resize-file-handler', {
      functionName: 'resize-file-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      entry: './resources/lambda/resize-file-handler.ts',
      handler: 'handler',
      layers: [layer],
      bundling: {
        externalModules: ['sharp'],
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 1536,
    });
    const s3PutEventSource = new lambdaEventSources.S3EventSource(bucket, {
      events: [s3.EventType.OBJECT_CREATED_PUT],
      filters: [{ prefix: 'raw/' }],
    });
    resizeFileHandler.addEventSource(s3PutEventSource);

    // bucket.grantReadWrite(presignedUrlHandler);
    bucket.grantReadWrite(resizeFileHandler);

    // api.root.addResource('presigned').addMethod('GET', new apigw.LambdaIntegration(presignedUrlHandler));

    const graphqlServerFargate = new GraphQLServerFargate(this, 'graphql-server-fargate', { s3: bucket });

    const vercelUser = new VercelIam(this, 'vercel-iam', { s3: bucket });
  }
}
