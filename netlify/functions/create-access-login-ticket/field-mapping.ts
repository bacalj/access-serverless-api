// Define field mappings for different request types
export const requestTypeFields: Record<number, Record<string, string>> = {
  // Request Type: Login to Access
  30: {
    name: 'customfield_10108',
    accessId: 'customfield_10103',
    description: 'description'
  }
}

/**
 * Maps user input values to JSM field values based on request type
 * @param requestTypeId The type of request being created
 * @param userInputValues The values provided by the user
 * @returns Formatted field values for JSM API
 */
export function mapFieldValues(requestTypeId: number, userInputValues: Record<string, any>): Record<string, any> {
  const fieldMapping = requestTypeFields[requestTypeId];

  if (!fieldMapping) {
    console.warn(`No field mapping found for request type ${requestTypeId}`);
    return {};
  }

  const formattedFieldValues: Record<string, any> = {};

  Object.keys(fieldMapping).forEach(fieldKey => {
    if (userInputValues[fieldKey] !== undefined) {
      formattedFieldValues[fieldMapping[fieldKey]] = userInputValues[fieldKey];
    }
  });

  return formattedFieldValues;
}