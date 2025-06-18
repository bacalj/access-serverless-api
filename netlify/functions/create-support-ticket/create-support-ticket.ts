import { Handler } from '@netlify/functions'
// @ts-ignore - handle node-fetch type issue
import fetch from 'node-fetch'
import FormData from 'form-data'
import { mapFieldValues } from './field-mapping'

// Define JSM request interface with flexible field values
// mapping of specific fields to JSM keys is visible in field-mapping
interface JsmRequest {
  serviceDeskId: number;
  requestTypeId: number;
  requestFieldValues: Record<string, any>;
  raiseOnBehalfOf?: string;
  temporaryAttachmentIds?: string[];
}

// Function to submit ProForma fields using official Atlassian Forms API
const submitProFormaFields = async (issueKey: string, proformaFields: any, auth: string) => {
  try {
    console.log('| 📝 Submitting ProForma fields...')

    // Step 1: Get the correct form ID associated with this issue
    const getFormsUrl = `https://api.atlassian.com/jira/forms/cloud/${process.env.JIRA_CLOUD_ID}/issue/${issueKey}/form`
    console.log('| 🔍 Getting forms for issue:', getFormsUrl)

    const getFormsResponse = await fetch(getFormsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!getFormsResponse.ok) {
      const getFormsError = await getFormsResponse.json();
      console.log('| ⚠️ Failed to get forms for issue:', getFormsResponse.status, getFormsError)
      throw new Error(`Failed to get forms: ${getFormsResponse.status} - ${JSON.stringify(getFormsError)}`)
    }

    const formsData = await getFormsResponse.json();
    console.log('| 📋 Forms associated with issue:', JSON.stringify(formsData, null, 2))

    // Find the correct form (should be the ProForma form)
    if (!formsData || formsData.length === 0) {
      throw new Error('No forms found associated with this issue')
    }

    // Use the first form (there should typically be only one ProForma form per issue)
    const formId = formsData[0].id;
    console.log('| 🎯 Using form ID:', formId)

    // Step 2: Save form answers using the correct form ID
    const saveAnswersUrl = `https://api.atlassian.com/jira/forms/cloud/${process.env.JIRA_CLOUD_ID}/issue/${issueKey}/form/${formId}`

    // Build answers object in the format expected by ProForma API
    // Based on documentation: answers should be objects with specific properties
    const answersPayload = {
      answers: {}
    };

    // Map fields to question IDs with correct ProForma format
    const questionMapping = {
      5: proformaFields.userIdAtResource,     // User ID at Resource
      8: proformaFields.resourceName,         // Resource dropdown
      9: proformaFields.keywords,             // Keywords (multi-select/checkboxes)
      13: proformaFields.suggestedKeyword     // Suggested Keywords
    };

    // Format answers according to ProForma API specification
    Object.entries(questionMapping).forEach(([questionId, value]) => {
      if (value && value !== '') {
        // ProForma expects answers as objects with 'text' property for text fields
        answersPayload.answers[questionId] = {
          text: value
        };
      }
    });

    console.log('| 🎯 ProForma save answers payload:', JSON.stringify(answersPayload, null, 2))
    console.log('| 🎯 Save answers endpoint:', saveAnswersUrl)

    // Step 1: Save the answers
    const saveResponse = await fetch(saveAnswersUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(answersPayload)
    });

    const saveResult = await saveResponse.json();

    if (!saveResponse.ok) {
      console.log('| ⚠️ ProForma save answers failed:', saveResponse.status, saveResult)
      throw new Error(`ProForma save API error: ${saveResponse.status} - ${JSON.stringify(saveResult)}`)
    }

    console.log('| ✅ ProForma answers saved successfully')

    // Step 3: Submit the form (optional - this locks the form)
    const submitUrl = `https://api.atlassian.com/jira/forms/cloud/${process.env.JIRA_CLOUD_ID}/issue/${issueKey}/form/${formId}/action/submit`
    console.log('| 🎯 Submit form endpoint:', submitUrl)

    const submitResponse = await fetch(submitUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    const submitResult = await submitResponse.json();

    if (!submitResponse.ok) {
      console.log('| ⚠️ ProForma submit failed (answers were saved):', submitResponse.status, submitResult)
      // Don't throw error here - answers were saved successfully
    } else {
      console.log('| ✅ ProForma form submitted successfully:', submitResult)
    }

  } catch (error) {
    console.error('| ❌ ProForma submission error:', error)
    throw error
  }
};

// Function to upload a temporary attachment
const uploadTemporaryAttachment = async (serviceDeskId: number, attachment: {
  fileName: string;
  contentType: string;
  fileData: string;
  size: number;
}) => {
  try {
    const { fileName, contentType, fileData, size } = attachment;

    // Create form data
    const form = new FormData();

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileData, 'base64');

    // Add the file to form data
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: contentType,
      knownLength: size
    });

    // Setup authentication
    const auth = Buffer.from(`${process.env.JIRA_API_EMAIL}:${process.env.JIRA_API_KEY}`).toString('base64');

    // Make the API request
    const response = await fetch(
      `${process.env.JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/attachTemporaryFile`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'X-Atlassian-Token': 'nocheck',
          'X-ExperimentalApi': 'true'
        },
        body: form
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to upload temporary attachment: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading temporary attachment:', error);
    throw error;
  }
};

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

  let requestBody: any = {}
  let jsmResponse = null
  let errorMessage: string | null = null

  if (event.body) {
    try {
      requestBody = JSON.parse(event.body)
      console.log('\n| 🔄 1 netlify received request body. Lets look at it:\n', requestBody)

      const { requestTypeId, serviceDeskId } = requestBody
      const userInputValues = requestBody.requestFieldValues || {}
      const formattedFieldValues = mapFieldValues(requestTypeId, userInputValues);

      // Step 1: Upload attachments and get temporary IDs
      const temporaryAttachmentIds: string[] = [];
      if (requestBody.attachments && Array.isArray(requestBody.attachments)) {
        for (const attachment of requestBody.attachments) {
          console.log(`Processing attachment: ${attachment.fileName}`);
          const uploadResponse = await uploadTemporaryAttachment(serviceDeskId, attachment);

          if (uploadResponse.temporaryAttachments && uploadResponse.temporaryAttachments.length > 0) {
            const tempIds = uploadResponse.temporaryAttachments.map(att => att.temporaryAttachmentId);
            temporaryAttachmentIds.push(...tempIds);
            console.log(`Uploaded temporary attachment: ${attachment.fileName}, ID: ${tempIds[0]}`);
          }
        }
      }

      // Step 2: Create the request with the temporary attachment IDs
      const dataForJSM: JsmRequest = {
        serviceDeskId,
        requestTypeId,
        requestFieldValues: {
          ...formattedFieldValues,
          // Add attachments field if we have any temporary IDs
          ...(temporaryAttachmentIds.length > 0 && {
            attachment: temporaryAttachmentIds
          })
        },
        // raiseOnBehalfOf: userInputValues.email
      }

      // Remove the separate temporaryAttachmentIds field since we're including it in requestFieldValues
      console.log('\n| 🔄 2 data mapped and formatted for JSM:\n', dataForJSM)

      // Log environment variable status (safely)
      // console.log('| 🔍 Environment Check:')
      // console.log(`| - JIRA_API_EMAIL: ${process.env.JIRA_API_EMAIL ? '✓ Set' : '✗ Missing'}`)
      // console.log(`| - JIRA_API_KEY: ${process.env.JIRA_API_KEY ? '✓ Set (length: ' + process.env.JIRA_API_KEY.length + ')' : '✗ Missing'}`)
      // console.log(`| - JSM_BASE_URL: ${process.env.JSM_BASE_URL ? '✓ Set' : '✗ Missing'}`)

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

      // Log the full response status and headers for debugging
      // console.log('| 🔍 Response Status:', response.status)
      // console.log('| 🔍 Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries())))

      try {
        jsmResponse = await response.json()
      } catch (e) {
        console.error('| 😳 Failed to parse response as JSON:', e)
        // Try to get the raw text to see what we're actually getting back
        const rawText = await response.text()
        console.error('| 😳 Raw response:', rawText)
        throw new Error(`Failed to parse response: ${rawText}`)
      }

      if (!response.ok) {
        errorMessage = `Error from JSM: ${response.status} ${response.statusText}`
        console.error('| 😳 JSM API Error:', errorMessage, jsmResponse)

        // Check for specific error conditions
        if (response.status === 401) {
          console.error('| 🔒 Authentication Error - This could indicate an expired or invalid API token')
        }
      } else {
        console.log('| ✅ JSM Response:', jsmResponse)

                // Step 3: Try to submit ProForma fields if JSM succeeded and we have ProForma data
        const proformaFields = {
          userIdAtResource: userInputValues.userIdAtResource,
          resourceName: userInputValues.resourceName,
          keywords: userInputValues.keywords,
          suggestedKeyword: userInputValues.suggestedKeyword
        };

        // Only attempt ProForma submission if we have at least one ProForma field with data
        const hasProFormaData = Object.values(proformaFields).some(value => value && value !== '');

        if (hasProFormaData && jsmResponse?.issueKey) {
          console.log('| 🎯 Attempting ProForma submission with fields:', proformaFields)
          console.log('| 🎯 Using ticket ID:', jsmResponse.issueKey)
          try {
            await submitProFormaFields(jsmResponse.issueKey, proformaFields, auth);
          } catch (proformaError) {
            console.log('| ⚠️ ProForma submission failed (JSM ticket still created):', proformaError.message)
          }
        } else {
          console.log('| ℹ️ No ProForma data to submit or missing ticket ID')
        }
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
