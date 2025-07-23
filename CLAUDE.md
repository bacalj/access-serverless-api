# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a collection of Netlify serverless functions that serve as endpoints for the Access CI UI QA Bot. The functions integrate with Jira Service Management (JSM) to create tickets for various request types including support tickets, access login help, and provider login help.

## Development Commands

### Deployment
- Deploy to production: `git push origin main` (auto-deploys via Netlify)

### Local Development
- No build command required (configured as "# no build command" in netlify.toml)
- Functions are TypeScript-based and deployed directly

### Testing
- Test functions locally using Netlify CLI (not currently configured in package.json)
- Test live functions at: `https://access-serverless-api.netlify.app/.netlify/functions/[function-name]`

## Architecture

### Core Function Types
1. **Ticket Creation Functions** (`create-*-ticket/`)
   - Handle POST requests to create JSM tickets
   - Use field mapping to transform user input to JSM field formats
   - Include CORS headers for cross-origin requests
   - Support file attachments via temporary attachment upload

2. **Utility Functions**
   - `get-form-structure/`: Retrieves JSM form field definitions
   - `get-field-documentation/`: API exploration and documentation
   - `test-create-one/`: Development testing endpoint

### Field Mapping System
Each ticket creation function uses a `field-mapping.ts` file that:
- Maps user-friendly field names to JSM custom field IDs
- Handles both traditional JSM fields and ProForma form fields
- Uses request type IDs (17, 30, 31) to determine appropriate mappings

### Request Types
- **17**: Support Ticket
- **30**: Access Login Help
- **31**: Provider Login Help

### Key Components

#### Authentication
- Uses Basic Auth with `JIRA_API_EMAIL` and `JIRA_API_KEY` environment variables
- Connects to JSM instance at `JSM_BASE_URL`

#### File Attachment Handling
- Supports base64 file uploads via `uploadTemporaryAttachment()`
- Creates temporary attachments first, then includes IDs in ticket creation
- Uses FormData for multipart file uploads

#### ProForma Integration
- Functions support both traditional JSM fields and ProForma form fields
- ProForma answers are mapped through `mapProformaValues()` function
- Form structure stored in `saved-form-definitions/` for reference

## Environment Variables Required
- `JIRA_API_EMAIL`: Jira user email for authentication
- `JIRA_API_KEY`: Jira API token
- `JSM_BASE_URL`: Base URL for JSM instance
- `JIRA_CLOUD_ID`: Cloud ID for ProForma API calls

## Function Structure Pattern
All functions follow this pattern:
1. CORS headers setup
2. OPTIONS request handling for preflight
3. Request body parsing
4. Field mapping transformation
5. Optional file attachment processing
6. JSM API call
7. Response formatting with error handling

## Saved Form Definitions
The `saved-form-definitions/` directory contains cached JSM field definitions:
- Used for development and AI-assisted coding
- Retrieved from JSM API endpoints
- Should be updated when form structures change