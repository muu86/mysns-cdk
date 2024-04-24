import * as iam from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

type VercelServerProps = {
  s3: Bucket;
};

export class VercelIam extends Construct {
  constructor(scope: Construct, id: string, props: VercelServerProps) {
    super(scope, id);

    const vercelUser = new iam.User(this, 'VercelUser');

    vercelUser.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject*', 's3:GetObject*'],
        resources: [props.s3.arnForObjects('*')],
      })
    );
  }
}
