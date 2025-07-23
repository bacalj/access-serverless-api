// Define field mappings for different request types
export const requestTypeFields: Record<number, Record<string, string>> = {
    // Request Type: Support Ticket
  17: {
    summary: 'summary',
    description: 'description',
    accessId: 'customfield_10103',
    name: 'customfield_10108',
    issueType: 'customfield_10111',
    priority: 'priority'
    // ProForma fields are now handled via embedded form section, not traditional mapping
    // userIdAtResource, resourceName, keywords, suggestedKeyword excluded from traditional mapping
  },
  // Request Type: Login to Access (loginAccess)
  30: {
    name: 'customfield_10108',
    accessId: 'customfield_10103',
    description: 'description'
  },
  // Request Type: Login to provider (loginProvider)
  31: {
    name: 'customfield_10108',
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

// ProForma question mappings for different request types
const proformaQuestionMappings: Record<number, Record<string, string>> = {
  // Request Type 17: Support Ticket
  17: {
    userIdAtResource: '5',      // Question 5: "Your User ID (at the Resource)" (text)
    resourceName: '8',          // Question 8: "Resource" (dropdown)
    keywords: '9',              // Question 9: "Keywords" (multi-select)
    suggestedKeyword: '13'      // Question 13: "Suggested Keyword" (text)
  },
  // Request Type 30: Cannot login to the ACCESS portal
  30: {
    identityProvider: '16',     // Question 16: "Identity Provider" (dropdown)
    browser: '17'               // Question 17: "Browser" (multi-select)
  }
  // Request Type 31: Cannot login to Resource Provider (structure TBD)
  // 31: {
  //   // To be added once ProForma structure is discovered
  // }
};

// ProForma field type mappings - defines how each field should be formatted
const proformaFieldTypes: Record<string, 'text' | 'choices'> = {
  // Request Type 17 fields
  '5': 'text',       // userIdAtResource - text field
  '8': 'choices',    // resourceName - dropdown (single choice)
  '9': 'choices',    // keywords - multi-select (multiple choices)
  '13': 'text',      // suggestedKeyword - text field
  // Request Type 30 fields
  '16': 'choices',   // identityProvider - dropdown (single choice)
  '17': 'choices'    // browser - multi-select (multiple choices)
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

/**
 * Maps ProForma field values to JSM form format
 * @param requestTypeId The type of request being created
 * @param userInputValues The values provided by the user
 * @returns Formatted ProForma answers for JSM API form section, or null if no ProForma fields
 */
export function mapProformaValues(requestTypeId: number, userInputValues: Record<string, any>): Record<string, any> | null {
  const questionMapping = proformaQuestionMappings[requestTypeId];

  if (!questionMapping) {
    // No ProForma fields for this request type
    return null;
  }

  const formattedAnswers: Record<string, any> = {};
  let hasProformaData = false;

  Object.keys(questionMapping).forEach(fieldKey => {
    if (userInputValues[fieldKey] !== undefined && userInputValues[fieldKey] !== '' && userInputValues[fieldKey] !== null) {
      const questionId = questionMapping[fieldKey];
      const fieldType = proformaFieldTypes[questionId];
      let value = userInputValues[fieldKey];

      hasProformaData = true;

      if (fieldType === 'text') {
        formattedAnswers[questionId] = { text: String(value) };
      } else if (fieldType === 'choices') {
        // Handle both single values and comma-separated multiple values
        if (Array.isArray(value)) {
          formattedAnswers[questionId] = { choices: value };
        } else {
          const choices = String(value).split(',').map(choice => choice.trim());
          formattedAnswers[questionId] = { choices: choices };
        }
      }
    }
  });

  if (!hasProformaData) {
    return null;
  }

  console.log(`📝 Mapped ${Object.keys(formattedAnswers).length} ProForma fields for request type ${requestTypeId}`);

  return formattedAnswers;
}