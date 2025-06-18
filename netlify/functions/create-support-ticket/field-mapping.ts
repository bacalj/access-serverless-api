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

// Issue type mapping for customfield_10111 (ACCESS User Support Issue)
const issueTypeMapping: Record<string, string> = {
  'user account question': '10212',
  'allocation question': '10213',
  'user support question': '10214',
  'cssn/ccep question': '10216',
  'training question': '10217',
  'metrics question': '10218',
  'ondemand question': '10219',
  'pegasus question': '10220',
  'xdmod question': '10221',
  'some other question': '10223',
  // Also accept the value IDs directly
  '10212': '10212',
  '10213': '10213',
  '10214': '10214',
  '10216': '10216',
  '10217': '10217',
  '10218': '10218',
  '10219': '10219',
  '10220': '10220',
  '10221': '10221',
  '10223': '10223'
};

/**
 * Maps priority values to JSM format
 * @param priority The priority value from user input
 * @returns JSM-compatible priority value object
 */
function mapPriorityValue(priority: any): { id: string } {
  if (!priority) {
    return { id: '3' }; // Default to medium priority
  }

  const priorityStr = String(priority).toLowerCase();
  const priorityId = priorityMapping[priorityStr] || '3'; // Default to medium if not found
  return { id: priorityId };
}

/**
 * Maps issue type values to JSM format for customfield_10111
 * @param issueType The issue type value from user input
 * @returns JSM-compatible issue type value object
 */
function mapIssueTypeValue(issueType: any): { id: string } {
  if (!issueType) {
    return { id: '10214' }; // Default to "User Support Question"
  }

  const issueTypeStr = String(issueType).toLowerCase();
  const issueTypeId = issueTypeMapping[issueTypeStr] || '10214'; // Default to "User Support Question" if not found
  return { id: issueTypeId };
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

      // Skip empty values to avoid sending blanks to JSM
      if (value === '' || value === null) {
        return;
      }

      // Special handling for priority field
      if (fieldKey === 'priority') {
        value = mapPriorityValue(value);
      }

      // Special handling for issue type field
      if (fieldKey === 'issueType') {
        value = mapIssueTypeValue(value);
      }

      formattedFieldValues[fieldMapping[fieldKey]] = value;
    }
  });

  console.log(`📋 Mapped ${Object.keys(formattedFieldValues).length} fields for request type ${requestTypeId}`);

  return formattedFieldValues;
}