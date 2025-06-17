import { Handler } from '@netlify/functions'
// @ts-ignore - handle node-fetch type issue
import fetch from 'node-fetch'

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

  try {
    // Get parameters from query string with defaults
    const serviceDeskId = event.queryStringParameters?.serviceDeskId || '1'
    const requestTypeId = event.queryStringParameters?.requestTypeId || '10006'

    // Setup authentication
    const auth = Buffer.from(`${process.env.DEV_JIRA_API_EMAIL}:${process.env.DEV_JIRA_API_KEY}`).toString('base64')

    // First, get the request types for the service desk
    const requestTypesResponse = await fetch(
      `${process.env.DEV_JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!requestTypesResponse.ok) {
      const errorData = await requestTypesResponse.json()
      throw new Error(`Failed to get request types: ${JSON.stringify(errorData)}`)
    }

    const requestTypes = await requestTypesResponse.json()
    console.log('Available request types:', requestTypes)

    // Now try to get the form structure
    const formResponse = await fetch(
      `https://api.atlassian.com/jira/forms/cloud/${process.env.DEV_JIRA_CLOUD_ID}/servicedesk/TJ/requesttype/${requestTypeId}/form`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-ExperimentalApi': 'opt-in'
        }
      }
    )

    if (!formResponse.ok) {
      const errorData = await formResponse.json()
      throw new Error(`Failed to get form structure: ${JSON.stringify(errorData)}`)
    }

    const formStructure = await formResponse.json()

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Form structure retrieved successfully',
        requestTypes,
        formStructure
      })
    }

  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Error getting form structure',
        error: error.message
      })
    }
  }
}
