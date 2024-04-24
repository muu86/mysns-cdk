import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3Event } from 'aws-lambda';
import sharp from 'sharp';
import { Readable } from 'stream';

export const handler = async (event: S3Event) => {
  try {
    const bucketName = event.Records[0].s3.bucket.name;
    const key = event.Records[0].s3.object.key;

    const s3 = new S3Client({});
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const response = await s3.send(getCommand);
    const stream = response.Body;

    let buffer;
    if (stream instanceof Readable) {
      buffer = Buffer.concat(await stream.toArray());
    } else {
      throw new Error('Object 가 Stream 타입이 아닙니다.');
    }

    // const imageBuffer = Buffer.from(event.body!, 'base64');
    const resize = [1080, 600, 200];
    const promises = resize.map((r) => sharp(buffer).resize({ width: r }).withMetadata().toBuffer());
    const resized = await Promise.all(promises);
    resized.sort((a, b) => b.byteLength - a.byteLength);

    const prefix = ['lg', 'md', 'sm'];
    const buffersPromise = resized.map((b, i) => {
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: `${prefix[i]}/${key.split('/')[1]}`,
        Body: b,
      });
      return s3.send(putCommand);
    });
    const result = await Promise.all(buffersPromise);
    console.log(result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'success',
        // key: key,
      }),
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'some error happened',
      }),
    };
  }
};
