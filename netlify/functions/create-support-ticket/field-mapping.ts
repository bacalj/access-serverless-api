// Define field mappings for different request types
export const requestTypeFields: Record<number, Record<string, string>> = {
  // Request Type: Support Ticket
  17: {
    summary: 'summary',
    description: 'description',
    accessId: 'customfield_10103',
    userName: 'customfield_10108',
    issueType: 'customfield_10111',
    priority: 'priority'
  },
  // Request Type: Login to Access (loginAccess)
  30: {
    userName: 'customfield_10108',
    accessId: 'customfield_10103',
    description: 'description'
  },
  // Request Type: Login to provider (loginProvider)
  31: {
    userName: 'customfield_10108',
    accessId: 'customfield_10103',
    accessResource: 'customfield_10110',
    description: 'description'
  },
}

// Priority mapping - maps user-friendly values to JSM priority IDs/names
const priorityMapping: Record<string, string> = {
  'low': '5',
  'medium': '3',
  'high': '2',
  'highest': '1',
  'lowest': '4',
  // Also accept numeric strings directly
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5'
};

/**
 * Maps priority values to JSM format
 * @param priority The priority value from user input
 * @returns JSM-compatible priority value
 */
function mapPriorityValue(priority: any): string {
  if (!priority) {
    return '3'; // Default to medium priority
  }

  const priorityStr = String(priority).toLowerCase();
  return priorityMapping[priorityStr] || '3'; // Default to medium if not found
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
      let value = userInputValues[fieldKey];

      // Special handling for priority field
      if (fieldKey === 'priority') {
        value = mapPriorityValue(value);
      }

      formattedFieldValues[fieldMapping[fieldKey]] = value;
    }
  });

  return formattedFieldValues;
}