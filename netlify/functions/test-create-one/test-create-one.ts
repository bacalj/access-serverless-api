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
  let jsmResponse = null
  let errorMessage: string | null = null

  if (event.body) {
    try {
      requestBody = JSON.parse(event.body)
      const { serviceDeskId, requestTypeId } = requestBody
      const { email, description, summary, priority } = requestBody.requestFieldValues

      const dataForJSM = {
        // Hardcoding serviceDesk and requestType IDs for test environment
        serviceDeskId: "1", // serviceDeskId
        requestTypeId: "10006", // requestTypeId
        requestFieldValues: {
          summary: summary,
          description: description,
          priority: priority || "Medium"
        },
      }

      console.log('| [1] data for JSM:', dataForJSM)

      // Send data to JSM
      const auth = Buffer.from(`${process.env.JIRA_API_EMAIL}:${process.env.JIRA_API_KEY}`).toString('base64')

      const response = await fetch(`${process.env.JSM_BASE_URL}/rest/servicedeskapi/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(dataForJSM)
      })

      jsmResponse = await response.json()

      if (!response.ok) {
        errorMessage = `Error from JSM: ${response.status} ${response.statusText}`
        console.error('| [0] JSM API Error:', errorMessage, jsmResponse)
      } else {
        console.log('| [1] JSM Response:', jsmResponse)
      }

    } catch (error) {
      console.error('| [0] Error:', error)
      errorMessage = `Error: ${error.message}`
    }
  }

  return {
    statusCode: errorMessage ? 500 : 200,
    headers,
    body: JSON.stringify({
      message: errorMessage || 'Request created successfully',
      receivedData: requestBody,
      jsmResponse: jsmResponse
    })
  }
}
