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
      // Extract field values
      const { email, description, summary } = requestBody.requestFieldValues || {}

      // Define JSM request interface to support raiseOnBehalfOf
      interface JsmRequest {
        serviceDeskId: number;
        requestTypeId: number;
        requestFieldValues: {
          summary: string;
          description: string;
        };
        raiseOnBehalfOf?: string;
      }

      const dataForJSM: JsmRequest = {
        // Confirmed values from JSM portal as numbers (not strings):
        // Service Desk ID: 1 (from URL https://digitalblockarea.atlassian.net/servicedesk/customer/portal/1)
        // Request Type IDs: 10006 (Submit a request or incident) or 10007 (Ask a question)
        serviceDeskId: 1, // Confirmed Test JSM service desk ID as number
        requestTypeId: 10006, // "Submit a request or incident" request type as number
        requestFieldValues: {
          summary: summary || "Support Request",
          description: description || "No description provided"
        },
      }

      // Add raiseOnBehalfOf field if email is provided
      // This will associate the request with the submitted email address
      if (email) {
        dataForJSM.raiseOnBehalfOf = email;
        console.log(`| 🔄 Creating request on behalf of: ${email}`);
      }

      console.log('| 🔄 data for JSM:', dataForJSM)

      // Send data to JSM
      const auth = Buffer.from(`${process.env.JIRA_API_EMAIL}:${process.env.JIRA_API_KEY}`).toString('base64')

      // Log the JSM URL we're using (for debugging, redact in production)
      const jsmUrl = `${process.env.JSM_BASE_URL}/rest/servicedeskapi/request`
      console.log('| 🔄 JSM URL:', jsmUrl)

      const response = await fetch(jsmUrl, {
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
        console.error('| 😳 JSM API Error:', errorMessage, jsmResponse)
      } else {
        console.log('| ✅ JSM Response:', jsmResponse)
      }

    } catch (error) {
      console.error('| 😳 Error:', error)
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
