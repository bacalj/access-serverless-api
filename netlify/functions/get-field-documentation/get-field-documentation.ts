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

    const documentation: FieldDocumentation = {
      requestTypeId,
      requestTypeName: '',
      jsmFields: {
        required: [],
        optional: []
      },
      proformaFields: {
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
           // Skip fields we don't need (like attachment fields that are handled separately)
           if (field.fieldId === 'attachment') {
             continue;
           }

           const humanField: HumanReadableField = {
             label: field.name || field.fieldId,
             description: cleanDescription(field.description) || `Field: ${field.name || field.fieldId}`,
             type: mapJsmFieldType(field.jiraSchema?.type, field.jiraSchema?.custom),
             source: 'jsm',
             fieldId: field.fieldId,
             required: field.required || false,
             semanticKey: generateSemanticKey(field.name || field.fieldId, 'jsm'),
             jiraSchema: field.jiraSchema
           }

           // Add choices for select fields (filter out unnecessary metadata)
           if (field.validValues && Array.isArray(field.validValues)) {
             humanField.choices = field.validValues
               .map(v => v.value || v.name || String(v))
               .filter(choice => choice && choice.trim() !== '')
           }

           // Only include if it has useful information
           if (humanField.label && humanField.label.trim() !== '') {
             // Categorize JSM fields as required or optional
             if (humanField.required) {
               documentation.jsmFields.required.push(humanField)
             } else {
               documentation.jsmFields.optional.push(humanField)
             }
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
             description: cleanDescription(question.description) || question.label || `ProForma question ${question.id}`,
             type: mapProFormaQuestionType(question.type),
             source: 'proforma',
             questionId: question.id,
             required: question.required || false,
             semanticKey: generateSemanticKey(question.label || `question_${question.id}`, 'proforma')
           }

           // Add choices for choice questions (filter out unnecessary metadata)
           if (question.choices && Array.isArray(question.choices)) {
             humanField.choices = question.choices
               .map(choice => choice.label || choice.value || String(choice))
               .filter(choice => choice && choice.trim() !== '')
           }

           // Only include if it has useful information
           if (humanField.label && humanField.label.trim() !== '') {
             // Categorize ProForma fields as required or optional
             if (humanField.required) {
               documentation.proformaFields.required.push(humanField)
             } else {
               documentation.proformaFields.optional.push(humanField)
             }
           }
         }
       }
    } else {
      console.log('❌ Failed to fetch ProForma fields:', formsResponse.status)
      const errorData = await formsResponse.json()
      console.log('Error details:', errorData)
    }

    // Step 4: Return formatted documentation with summary
    console.log('✅ Documentation complete!')
    const totalJsm = documentation.jsmFields.required.length + documentation.jsmFields.optional.length
    const totalProforma = documentation.proformaFields.required.length + documentation.proformaFields.optional.length
    const totalRequired = documentation.jsmFields.required.length + documentation.proformaFields.required.length
    const totalOptional = documentation.jsmFields.optional.length + documentation.proformaFields.optional.length

    console.log(`- JSM fields: ${totalJsm} (${documentation.jsmFields.required.length} required, ${documentation.jsmFields.optional.length} optional)`)
    console.log(`- ProForma fields: ${totalProforma} (${documentation.proformaFields.required.length} required, ${documentation.proformaFields.optional.length} optional)`)
    console.log(`- Total: ${totalJsm + totalProforma} fields`)

    const response = {
      summary: {
        serviceDeskId,
        requestTypeId,
        requestTypeName: documentation.requestTypeName,
        totalFields: totalJsm + totalProforma,
        requiredFields: totalRequired,
        optionalFields: totalOptional,
        jsm: {
          total: totalJsm,
          required: documentation.jsmFields.required.length,
          optional: documentation.jsmFields.optional.length
        },
        proforma: {
          total: totalProforma,
          required: documentation.proformaFields.required.length,
          optional: documentation.proformaFields.optional.length
        }
      },
      documentation
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