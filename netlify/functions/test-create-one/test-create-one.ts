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
    } catch (error) {
      console.error('| [0] Error parsing request body:', error)
    }
  }

  // Test endpoint to get JSM request schema
  try {
    // Use the provided environment variables
    const atlassianDomain = process.env.JSM_BASE_URL
    const email = process.env.JIRA_API_EMAIL
    const apiToken = process.env.JIRA_API_KEY

    if (email && apiToken) {
      const auth = Buffer.from(`${email}:${apiToken}`).toString('base64')

      // Make a GET request to see available service desks first
      const serviceDesksResponse = await fetch(
        `https://${atlassianDomain}/rest/servicedeskapi/servicedesk`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      )

      const serviceDesksData = await serviceDesksResponse.json()
      console.log('| [0] Available service desks:', serviceDesksData)

    }
  } catch (error) {
    console.error('| [0] Error accessing JSM API:', error)
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
