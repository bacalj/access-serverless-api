import { Handler } from '@netlify/functions'
// @ts-ignore - handle node-fetch type issue
import fetch from 'node-fetch'
import FormData from 'form-data'
import { mapFieldValues } from './dev-field-mapping'

// Define JSM request interface with flexible field values
// mapping of specific fields to JSM keys is visible in dev-field-mapping
interface JsmRequest {
  serviceDeskId: number;
  requestTypeId: number;
  requestFieldValues: Record<string, any>;
  raiseOnBehalfOf?: string;
  temporaryAttachmentIds?: string[];
}

// Function to upload a temporary attachment
const uploadTemporaryAttachment = async (serviceDeskId: number, attachment: {
  fileName: string;
  contentType: string;
  fileData: string;
  size: number;
}) => {
  console.log('| 🏞️ uploading temporary attachment')
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
    const auth = Buffer.from(`${process.env.DEV_JIRA_API_EMAIL}:${process.env.DEV_JIRA_API_KEY}`).toString('base64');

    // Make the API request
    const response = await fetch(
      `${process.env.DEV_JSM_BASE_URL}/rest/servicedeskapi/servicedesk/${serviceDeskId}/attachTemporaryFile`,
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
        raiseOnBehalfOf: userInputValues.email
      }

      // Remove the separate temporaryAttachmentIds field since we're including it in requestFieldValues
      console.log('\n| 🔄 2 data mapped and formatted for JSM:\n', dataForJSM)

      // Log environment variable status (safely)
      // console.log('| 🔍 Environment Check:')
      // console.log(`| - DEV_JIRA_API_EMAIL: ${process.env.DEV_JIRA_API_EMAIL ? '✓ Set' : '✗ Missing'}`)
      // console.log(`| - DEV_JIRA_API_KEY: ${process.env.DEV_JIRA_API_KEY ? '✓ Set (length: ' + process.env.DEV_JIRA_API_KEY.length + ')' : '✗ Missing'}`)
      // console.log(`| - DEV_JSM_BASE_URL: ${process.env.DEV_JSM_BASE_URL ? '✓ Set' : '✗ Missing'}`)

      // Send data to JSM
      const auth = Buffer.from(`${process.env.DEV_JIRA_API_EMAIL}:${process.env.DEV_JIRA_API_KEY}`).toString('base64')

      const response = await fetch(`${process.env.DEV_JSM_BASE_URL}/rest/servicedeskapi/request`, {
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
