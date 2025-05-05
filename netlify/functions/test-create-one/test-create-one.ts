import { Handler } from '@netlify/functions'
// @ts-ignore - handle node-fetch type issue
import fetch from 'node-fetch'

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

  // Parse and log the request body
  let requestBody: any = {}
  if (event.body) {
    try {
      requestBody = JSON.parse(event.body)
      console.log('| [0] Request body:', requestBody)
      const { serviceDeskId, requestTypeId } = requestBody
      const { email, description, summary, priority } = requestBody.requestFieldValues

      console.log('| [1] values to pass to JSM:', {
        'serviceDeskId': serviceDeskId,
        'requestTypeId': requestTypeId,
        'email': email,
        'description': description,
        'summary': summary,
        'priority': priority
      })
    } catch (error) {
      console.error('| [0] Error parsing request body:', error)
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: `Hello, this is a message from the test-create-one function`,
      receivedData: requestBody
    })
  }
}
