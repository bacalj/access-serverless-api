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
    const serviceDeskId = event.queryStringParameters?.serviceDeskId || 'TJ'
    const requestTypeId = parseInt(event.queryStringParameters?.requestTypeId || '10006', 10)

    // Log all relevant information
    console.log('Environment variables:')
    console.log('- Cloud ID:', process.env.DEV_JIRA_CLOUD_ID)
    console.log('- JSM Base URL:', process.env.DEV_JSM_BASE_URL)
    console.log('Request parameters:')
    console.log('- Service Desk ID:', serviceDeskId)
    console.log('- Request Type ID:', requestTypeId)

    const url = `https://api.atlassian.com/jira/forms/cloud/${process.env.DEV_JIRA_CLOUD_ID}/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}/form`
    console.log('Request URL:', url)

    // Setup authentication
    const auth = Buffer.from(`${process.env.DEV_JIRA_API_EMAIL}:${process.env.DEV_JIRA_API_KEY}`).toString('base64')

    // Make the API request to get form structure
    const response = await fetch(
      url,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'X-ExperimentalApi': 'opt-in'
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('API Error Response:', errorData)
      throw new Error(`Failed to get form structure: ${JSON.stringify(errorData)}`)
    }

    const formStructure = await response.json()

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Form structure retrieved successfully',
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
