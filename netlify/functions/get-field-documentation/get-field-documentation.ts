import { Handler } from '@netlify/functions'
// @ts-ignore - handle node-fetch type issue
import fetch from 'node-fetch'

interface HumanReadableField {
  label: string;
  description: string;
  type: string;
  source: 'jsm' | 'proforma';
  fieldId?: string;
  questionId?: string;
  choices?: string[];
  required?: boolean;
}

interface FieldDocumentation {
  requestTypeId: string;
  requestTypeName: string;
  humanReadableFields: {
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

    const documentation: FieldDocumentation = {
      requestTypeId,
      requestTypeName: '',
      humanReadableFields: {
        required: [],
        optional: []
      }
    }

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
      documentation.requestTypeName = jsmRequestTypeData.name || `Request Type ${requestTypeId}`
      console.log('✅ JSM Request Type Name:', documentation.requestTypeName)
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

    if (jsmFieldsResponse.ok) {
      const jsmFieldsData = await jsmFieldsResponse.json()
      console.log('✅ JSM Fields received:', jsmFieldsData.requestTypeFields?.length || 0, 'fields')

      // Process JSM fields
      if (jsmFieldsData.requestTypeFields) {
        for (const field of jsmFieldsData.requestTypeFields) {
          const humanField: HumanReadableField = {
            label: field.name || field.fieldId,
            description: field.description || `Field: ${field.name || field.fieldId}`,
            type: mapJsmFieldType(field.jiraSchema?.type, field.jiraSchema?.custom),
            source: 'jsm',
            fieldId: field.fieldId,
            required: field.required || false
          }

          // Add choices for select fields
          if (field.validValues && Array.isArray(field.validValues)) {
            humanField.choices = field.validValues.map(v => v.value || v.name || String(v))
          }

          // Categorize as required or optional
          if (humanField.required) {
            documentation.humanReadableFields.required.push(humanField)
          } else {
            documentation.humanReadableFields.optional.push(humanField)
          }
        }
      }
    } else {
      console.log('❌ Failed to fetch JSM fields:', jsmFieldsResponse.status)
    }

    // Step 3: Get ProForma fields
    console.log('📋 Fetching ProForma fields...')
    const formsApiUrl = `https://api.atlassian.com/jira/forms/cloud/${process.env.JIRA_CLOUD_ID}/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}/form`
    const formsResponse = await fetch(formsApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'X-ExperimentalApi': 'opt-in'
      }
    })

    if (formsResponse.ok) {
      const formsData = await formsResponse.json()
      console.log('✅ ProForma form received')

      // Process ProForma questions
      if (formsData.questions && Array.isArray(formsData.questions)) {
        for (const question of formsData.questions) {
          const humanField: HumanReadableField = {
            label: question.label || `Question ${question.id}`,
            description: question.description || question.label || `ProForma question ${question.id}`,
            type: mapProFormaQuestionType(question.type),
            source: 'proforma',
            questionId: question.id,
            required: question.required || false
          }

          // Add choices for choice questions
          if (question.choices && Array.isArray(question.choices)) {
            humanField.choices = question.choices.map(choice => choice.label || choice.value || String(choice))
          }

          // Categorize as required or optional
          if (humanField.required) {
            documentation.humanReadableFields.required.push(humanField)
          } else {
            documentation.humanReadableFields.optional.push(humanField)
          }
        }
      }
    } else {
      console.log('❌ Failed to fetch ProForma fields:', formsResponse.status)
      const errorData = await formsResponse.json()
      console.log('Error details:', errorData)
    }

    // Step 4: Return formatted documentation
    console.log('✅ Documentation complete!')
    console.log(`- Required fields: ${documentation.humanReadableFields.required.length}`)
    console.log(`- Optional fields: ${documentation.humanReadableFields.optional.length}`)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(documentation, null, 2)
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