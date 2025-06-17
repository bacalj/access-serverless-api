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

    console.log('🔍 Starting discovery with:')
    console.log('- Service Desk ID:', serviceDeskId)
    console.log('- Request Type ID:', requestTypeId)
    console.log('- JSM Base URL:', process.env.DEV_JSM_BASE_URL)

    // Setup authentication (same as working endpoint)
    const auth = Buffer.from(`${process.env.DEV_JIRA_API_EMAIL}:${process.env.DEV_JIRA_API_KEY}`).toString('base64')

    // Try to get request type details first
    const requestTypeUrl = `${process.env.DEV_JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}`
    console.log('🎯 Trying request type URL:', requestTypeUrl)

    const requestTypeResponse = await fetch(requestTypeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    console.log('📊 Request Type Response Status:', requestTypeResponse.status)

    if (requestTypeResponse.ok) {
      const requestTypeData = await requestTypeResponse.json()
      console.log('✅ Request Type Data:', JSON.stringify(requestTypeData, null, 2))
    } else {
      const errorData = await requestTypeResponse.json()
      console.log('❌ Request Type Error:', JSON.stringify(errorData, null, 2))
    }

    // Try to get service desk info
    const serviceDeskUrl = `${process.env.DEV_JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}`
    console.log('🏢 Trying service desk URL:', serviceDeskUrl)

    const serviceDeskResponse = await fetch(serviceDeskUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    console.log('📊 Service Desk Response Status:', serviceDeskResponse.status)

    if (serviceDeskResponse.ok) {
      const serviceDeskData = await serviceDeskResponse.json()
      console.log('✅ Service Desk Data:', JSON.stringify(serviceDeskData, null, 2))
    } else {
      const errorData = await serviceDeskResponse.json()
      console.log('❌ Service Desk Error:', JSON.stringify(errorData, null, 2))
    }

    // Try to list all request types for this service desk
    const allRequestTypesUrl = `${process.env.DEV_JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype`
    console.log('📋 Trying all request types URL:', allRequestTypesUrl)

    const allRequestTypesResponse = await fetch(allRequestTypesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    console.log('📊 All Request Types Response Status:', allRequestTypesResponse.status)

    let allRequestTypesData = null
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
        message: 'Discovery complete - check logs for details',
        summary: {
          serviceDeskId,
          requestTypeId,
          requestTypeFound: requestTypeResponse.ok,
          serviceDeskFound: serviceDeskResponse.ok,
          allRequestTypesFound: allRequestTypesResponse.ok,
          totalRequestTypes: allRequestTypesData?.size || 0
        }
      })
    }

  } catch (error) {
    console.error('💥 Discovery Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Discovery failed',
        error: error.message
      })
    }
  }
}
