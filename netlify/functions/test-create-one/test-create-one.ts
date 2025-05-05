import { Handler } from '@netlify/functions'


export const handler: Handler = async (event, context) => {
  const localEnvVar = process.env.LOCAL_VAL
  const { name = 'stranger' } = event.queryStringParameters || {}

  console.log('| [0] event', event)
  console.log('| [0] context', context)

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello, ${name}! The local env var is ${localEnvVar}`,
    }),
  }
}
