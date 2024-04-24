import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { APIGatewayProxyEvent } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    if (!event.queryStringParameters || !event.queryStringParameters['key']) {
      throw new Error('key 파라미터가 null 입니다.');
    }
    const key = event.queryStringParameters['key'];
    const s3 = new S3Client({});
    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `raw/${key}`,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 60 });

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: url,
      }),
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: err.message,
      }),
    };
  }
};
