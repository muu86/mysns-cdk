import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

type GraphQLServerFargateProps = {
  s3: Bucket;
};

export class GraphQLServerFargate extends Construct {
  constructor(scope: Construct, id: string, props: GraphQLServerFargateProps) {
    super(scope, id);

    const cluster = new ecs.Cluster(this, 'mysns-graphql-server-cluster', {
      clusterName: 'mysns-graphql-server-cluster',
    });

    const repository = ecr.Repository.fromRepositoryName(
      scope,
      'mysns-graphql-server-ecr',
      'express-graphql-prisma-server'
    );

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'mysns-fargate-task-definition', {
      family: 'mysns-graphql-server-task-definition',
    });
    taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject*', 's3:GetObject*'],
        resources: [props.s3.arnForObjects('*')],
      })
    );
    taskDefinition.addContainer('graphql-server', {
      image: ecs.ContainerImage.fromEcrRepository(repository),
      portMappings: [
        {
          containerPort: 8000,
        },
      ],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'sns-graphql-server-log-group',
        logRetention: RetentionDays.ONE_MONTH,
      }),
      environment: {
        BUCKET_NAME: props.s3.bucketName,
      },
    });

    const cert = acm.Certificate.fromCertificateArn(
      this,
      'mysns-cert',
      'arn:aws:acm:ap-northeast-2:347192894377:certificate/45ef43ec-6cdb-4cc8-bbe3-0707ba7f9065'
    );

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'mysns-zone', {
      hostedZoneId: 'Z09067142Z9BNZML4EH5L',
      zoneName: 'babyheight.com',
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      'mysns-graphql-server-fargate',
      {
        cluster: cluster,
        taskDefinition: taskDefinition,
        certificate: cert,
        domainName: 'graphql.babyheight.com',
        domainZone: zone,
        desiredCount: 1,
        healthCheck: {
          command: ['CMD-SHELL', 'curl -f http://localhost:8000/health || exit 1'],
        },
      }
    );

    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
    });
  }
}
