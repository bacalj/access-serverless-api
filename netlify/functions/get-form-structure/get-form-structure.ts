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
    const serviceDeskId = event.queryStringParameters?.serviceDeskId || '2'
    const requestTypeId = event.queryStringParameters?.requestTypeId || '17'

    console.log('🔍 Starting ProForma discovery with:')
    console.log('- Service Desk ID:', serviceDeskId)
    console.log('- Request Type ID:', requestTypeId)
    console.log('- Cloud ID:', process.env.JIRA_CLOUD_ID)

    // Setup authentication for production
    const auth = Buffer.from(`${process.env.JIRA_API_EMAIL}:${process.env.JIRA_API_KEY}`).toString('base64')

    // Try the Forms API endpoint for ProForma forms
    const formsApiUrl = `https://api.atlassian.com/jira/forms/cloud/${process.env.JIRA_CLOUD_ID}/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}/form`
    console.log('🎯 Trying Forms API URL:', formsApiUrl)

    const formsResponse = await fetch(formsApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'X-ExperimentalApi': 'opt-in'
      }
    })

    console.log('📊 Forms API Response Status:', formsResponse.status)

    if (formsResponse.ok) {
      const formsData = await formsResponse.json()
      console.log('✅ Forms API Data:', JSON.stringify(formsData, null, 2))
    } else {
      const errorData = await formsResponse.json()
      console.log('❌ Forms API Error:', JSON.stringify(errorData, null, 2))
    }

    // Also try the regular JSM API for comparison
    const jsmApiUrl = `${process.env.JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}`
    console.log('🏢 Trying JSM API URL for comparison:', jsmApiUrl)

    const jsmResponse = await fetch(jsmApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    console.log('📊 JSM API Response Status:', jsmResponse.status)

    if (jsmResponse.ok) {
      const jsmData = await jsmResponse.json()
      console.log('✅ JSM API Data:', JSON.stringify(jsmData, null, 2))
    } else {
      const errorData = await jsmResponse.json()
      console.log('❌ JSM API Error:', JSON.stringify(errorData, null, 2))
    }

    // Try to get all request types to see what's available
    const allRequestTypesUrl = `${process.env.JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype`
    console.log('📋 Trying all request types URL:', allRequestTypesUrl)

    const allRequestTypesResponse = await fetch(allRequestTypesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    console.log('📊 All Request Types Response Status:', allRequestTypesResponse.status)

    let allRequestTypesData: any = null
    if (allRequestTypesResponse.ok) {
      allRequestTypesData = await allRequestTypesResponse.json()
      console.log('✅ All Request Types Data:', JSON.stringify(allRequestTypesData, null, 2))
    } else {
      const errorData = await allRequestTypesResponse.json()
      console.log('❌ All Request Types Error:', JSON.stringify(errorData, null, 2))
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'ProForma discovery complete - check logs for details',
        summary: {
          serviceDeskId,
          requestTypeId,
          formsApiWorking: formsResponse.ok,
          jsmApiWorking: jsmResponse.ok,
          allRequestTypesFound: allRequestTypesResponse.ok,
          totalRequestTypes: allRequestTypesData?.size || 0
        }
      })
    }

  } catch (error) {
    console.error('💥 ProForma Discovery Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'ProForma discovery failed',
        error: error.message
      })
    }
  }
}