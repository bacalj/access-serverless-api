// Define field mappings for different request types
// OJO: we don't list `email` as a field becuase in this case its not a field in the JSM type
// But we do use it to populate raiseOnBehalfOf
// We may do it differently in prod...
export const requestTypeFields: Record<number, Record<string, string>> = {
  // Request Type: Support Ticket
  10006: {
    summary: 'summary',
    description: 'description',
    // accessId: 'customfield_10091'
  },
  // Request Type: Question
  10007: {
    summary: 'summary',
    description: 'description',
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