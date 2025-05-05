import { Handler } from '@netlify/functions'

export const handler: Handler = async (event, context) => {
  // Define CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  // Handle OPTIONS request (preflight request)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    }
  }

  const localEnvVar = process.env.LOCAL_VAL
  const { name = 'stranger' } = event.queryStringParameters || {}

  console.log('| [0] event', event)
  console.log('| [0] context', context)

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: `Hello, ${name}! The local env var is ${localEnvVar}`,
    }),
  }
}
