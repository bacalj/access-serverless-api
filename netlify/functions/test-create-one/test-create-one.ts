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

  // Create a JSM request
  try {
    // Use the provided environment variables
    const atlassianDomain = process.env.JSM_BASE_URL
    const email = process.env.JIRA_API_EMAIL
    const apiToken = process.env.JIRA_API_KEY

    let jsmResponse = null

    if (email && apiToken) {
      const auth = Buffer.from(`${email}:${apiToken}`).toString('base64')

      // Create a request in JSM using the service desk ID we know (1)
      const serviceDeskId = "1"

      // Get or create request type ID - if not provided, we'll need to look it up
      let requestTypeId = requestBody.requestTypeId

      if (!requestTypeId) {
        // Get available request types for this service desk
        const requestTypesResponse = await fetch(
          `https://${atlassianDomain}/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        )

        const requestTypesData = await requestTypesResponse.json()
        console.log('| [0] Available request types:', requestTypesData)

        // Use the first request type if available
        if (requestTypesData.values && requestTypesData.values.length > 0) {
          requestTypeId = requestTypesData.values[0].id
        }
      }

      if (requestTypeId) {
        // Create the request
        const createRequestResponse = await fetch(
          `https://${atlassianDomain}/rest/servicedeskapi/request`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              serviceDeskId: serviceDeskId,
              requestTypeId: requestTypeId,
              requestFieldValues: {
                summary: requestBody.summary || "Test request created via API",
                description: requestBody.description || "This is a test request created via the REST API."
              }
            })
          }
        )

        jsmResponse = await createRequestResponse.json()
        console.log('| [0] JSM create request response:', jsmResponse)
      } else {
        console.error('| [0] No request type ID available')
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Hello, this is a message from the test-create-one function`,
        receivedData: requestBody,
        jsmResponse
      })
    }
  } catch (error) {
    console.error('| [0] Error accessing JSM API:', error)

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Error creating JSM request',
        error: error.message,
        receivedData: requestBody
      })
    }
  }
}
