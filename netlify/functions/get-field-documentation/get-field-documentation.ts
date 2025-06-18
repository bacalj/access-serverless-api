import { Handler } from '@netlify/functions'
// @ts-ignore - handle node-fetch type issue
import fetch from 'node-fetch'

interface FieldChoice {
  label: string;   // Human-readable display text
  value: string;   // API value/ID to submit
}

interface HumanReadableField {
  label: string;
  description: string;
  type: string;
  source: 'jsm' | 'proforma';
  fieldId?: string;
  questionId?: string;
  choices?: FieldChoice[];
  required?: boolean;
  // Additional mapping data
  semanticKey?: string; // Suggested semantic key for frontend mapping
  jiraSchema?: any; // Raw Jira schema for advanced mapping
}

interface FieldDocumentation {
  requestTypeId: string;
  requestTypeName: string;
  jsmFields: {
    required: HumanReadableField[];
    optional: HumanReadableField[];
  };
  proformaFields: {
    required: HumanReadableField[];
    optional: HumanReadableField[];
  };
}

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

    console.log('🔍 Starting field documentation generation for:')
    console.log('- Service Desk ID:', serviceDeskId)
    console.log('- Request Type ID:', requestTypeId)

    // Setup authentication
    const auth = Buffer.from(`${process.env.JIRA_API_EMAIL}:${process.env.JIRA_API_KEY}`).toString('base64')

    let requestTypeName = ''

    // Step 1: Get JSM request type information and fields
    console.log('📋 Fetching JSM request type information...')
    const jsmRequestTypeUrl = `${process.env.JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}`
    const jsmRequestTypeResponse = await fetch(jsmRequestTypeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    if (jsmRequestTypeResponse.ok) {
      const jsmRequestTypeData = await jsmRequestTypeResponse.json()
      requestTypeName = jsmRequestTypeData.name || `Request Type ${requestTypeId}`
      console.log('✅ JSM Request Type Name:', requestTypeName)
    }

    // Step 2: Get JSM fields for this request type
    console.log('📋 Fetching JSM fields...')
    const jsmFieldsUrl = `${process.env.JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}/field`
    const jsmFieldsResponse = await fetch(jsmFieldsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    let rawJsmFieldsData: any = null
    let jsmError: any = null

    if (jsmFieldsResponse.ok) {
      rawJsmFieldsData = await jsmFieldsResponse.json()
      if (rawJsmFieldsData !== null) {
        console.log('✅ JSM Fields received:', rawJsmFieldsData?.requestTypeFields?.length || 0, 'fields')
      } else {
        console.log('❌ JSM Fields received:', rawJsmFieldsData)
      }
    } else {
      console.log('❌ Failed to fetch JSM fields:', jsmFieldsResponse.status)
      try {
        jsmError = await jsmFieldsResponse.json()
      } catch (e) {
        jsmError = await jsmFieldsResponse.text()
      }
    }

            // Step 3: Get ProForma fields - RAW DATA FOR INSPECTION
    console.log('📋 Fetching ProForma fields...')
    console.log('- Cloud ID:', process.env.JIRA_CLOUD_ID)
    const formsApiUrl = `https://api.atlassian.com/jira/forms/cloud/${process.env.JIRA_CLOUD_ID}/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}/form`
    console.log('🎯 ProForma API URL:', formsApiUrl)

    const formsResponse = await fetch(formsApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'X-ExperimentalApi': 'opt-in'
      }
    })

    console.log('📊 ProForma Response Status:', formsResponse.status)

    let rawProFormaData: any = null
    let proFormaError: any = null

    if (formsResponse.ok) {
      rawProFormaData = await formsResponse.json()
      console.log('✅ ProForma form received - returning raw data for inspection')
    } else {
      console.log('❌ Failed to fetch ProForma fields:', formsResponse.status)
      try {
        proFormaError = await formsResponse.json()
      } catch (e) {
        proFormaError = await formsResponse.text()
      }
    }



        // Step 4: Return simplified response with just summary and raw data
    console.log('✅ API calls complete.  Here is data we can use to build the field documentation!')
    console.log(`- JSM API: ${rawJsmFieldsData ? 'success' : 'failed'}`)
    console.log(`- ProForma API: ${rawProFormaData ? 'success' : 'failed'}`)

    const response = {
      summary: {
        serviceDeskId,
        requestTypeId,
        requestTypeName,
        jsm: {
          apiStatus: rawJsmFieldsData ? 'success' : 'failed',
          fieldCount: rawJsmFieldsData?.requestTypeFields?.length || 0
        },
        proforma: {
          apiStatus: rawProFormaData ? 'success' : 'failed',
          questionCount: rawProFormaData?.questions?.length || 0
        }
      },
      rawApiData: {
        jsm: {
          data: rawJsmFieldsData,
          error: jsmError
        },
        proforma: {
          data: rawProFormaData,
          error: proFormaError
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response, null, 2)
    }

  } catch (error) {
    console.error('💥 Field Documentation Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Field documentation generation failed',
        error: error.message
      })
    }
  }
}

/**
 * Generates a semantic key for field mapping from frontend to backend
 */
function generateSemanticKey(label: string, source: 'jsm' | 'proforma'): string {
  const baseKey = label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .replace(/_+/g, '_'); // Collapse multiple underscores

  // Handle common field mappings
  const keyMappings: Record<string, string> = {
    'summary': 'summary',
    'description': 'description',
    'issue_description': 'description',
    'priority': 'priority',
    'access_id': 'accessId',
    'user_name': 'userName',
    'full_name': 'userName',
    'name': 'userName',
    'issue_type': 'issueType',
    'type_of_issue': 'issueType',
    'access_resource': 'accessResource',
    'resource': 'accessResource',
    'does_your_problem_involve_an_access_resource': 'resourceInvolved',
    'identity_provider': 'identityProvider',
    'browser': 'browser',
    'keywords': 'keywords',
    'suggested_keyword': 'suggestedKeyword'
  };

  return keyMappings[baseKey] || baseKey;
}

/**
 * Cleans up field descriptions by removing unnecessary HTML, icons, and metadata
 */
function cleanDescription(description: string): string {
  if (!description) return '';

  return description
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove icon references
    .replace(/\s*icon\s*:\s*[^\s,}]+/gi, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Maps JSM field types to human-readable types
 */
function mapJsmFieldType(jiraType: string, customType?: string): string {
  if (customType) {
    // Handle custom field types
    switch (customType) {
      case 'com.atlassian.jira.plugin.system.customfieldtypes:select':
        return 'choice'
      case 'com.atlassian.jira.plugin.system.customfieldtypes:multiselect':
        return 'multiple_choice'
      case 'com.atlassian.jira.plugin.system.customfieldtypes:textfield':
        return 'text'
      case 'com.atlassian.jira.plugin.system.customfieldtypes:textarea':
        return 'long_text'
      default:
        return 'custom'
    }
  }

  // Handle standard field types
  switch (jiraType) {
    case 'string':
      return 'text'
    case 'priority':
      return 'choice'
    case 'user':
      return 'user_picker'
    case 'option':
      return 'choice'
    case 'array':
      return 'multiple_choice'
    default:
      return jiraType || 'unknown'
  }
}

/**
 * Maps ProForma question types to human-readable types
 */
function mapProFormaQuestionType(questionType: string): string {
  switch (questionType) {
    case 'cs':
      return 'choice'
    case 'cm':
      return 'multiple_choice'
    case 'cd':
      return 'dropdown'
    case 'cl':
      return 'checklist'
    case 'ts':
      return 'text'
    case 'tl':
      return 'long_text'
    case 'tn':
      return 'number'
    case 'td':
      return 'date'
    case 'te':
      return 'email'
    case 'tu':
      return 'url'
    default:
      return questionType || 'unknown'
  }
}