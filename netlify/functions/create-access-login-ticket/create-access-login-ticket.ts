import { Handler } from '@netlify/functions'
import { mapFieldValues } from './field-mapping'

export const handler: Handler = async (event, context) => {
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

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: 'Hello from create-access-login-ticket function!',
      note: 'This is a stub - implement your logic here'
    })
  }
}