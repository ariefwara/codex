# Codex API Documentation

## Authentication

The Codex API uses JWT (JSON Web Tokens) for authentication. Most endpoints require a valid JWT token in the Authorization header.

### Login
- **Endpoint**: `POST /api/auth/login`
- **Description**: Authenticate a user and receive a JWT token
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "token": "jwt_token_string",
    "user": {
      "id": "user_id",
      "username": "username",
      "email": "email@example.com",
      "displayName": "Display Name"
    }
  }
  ```
- **Errors**:
  - 400: Missing username or password
  - 401: Invalid credentials
  - 500: Internal server error

### Get Current User
- **Endpoint**: `GET /api/auth/me`
- **Description**: Get information about the currently authenticated user
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Response**:
  ```json
  {
    "id": "user_id",
    "username": "username",
    "email": "email@example.com",
    "displayName": "Display Name",
    "groups": ["group1", "group2"]
  }
  ```

## Documents

### Upload Document
- **Endpoint**: `POST /api/documents/upload`
- **Description**: Upload a new document
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Form Data**:
  - `file`: The file to upload
- **Response**:
  ```json
  {
    "message": "Document uploaded successfully",
    "documentId": "document_id",
    "fileName": "filename.pdf",
    "size": 123456
  }
  ```

### List Documents
- **Endpoint**: `GET /api/documents`
- **Description**: Get a list of documents the user has access to
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Response**:
  ```json
  [
    {
      "_id": "document_id",
      "name": "document_name.pdf",
      "size": 123456,
      "mimeType": "application/pdf",
      "uploadedAt": "2023-01-01T12:00:00Z",
      "lastAccessed": "2023-01-01T12:00:00Z",
      "uploadedBy": "user_id",
      "tags": ["tag1", "tag2"]
    }
  ]
  ```

### Get Document
- **Endpoint**: `GET /api/documents/:id`
- **Description**: Get detailed information about a specific document
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Response**:
  ```json
  {
    "_id": "document_id",
    "name": "document_name.pdf",
    "path": "path/in/storage",
    "size": 123456,
    "mimeType": "application/pdf",
    "contentHash": "sha256_hash",
    "metadata": {
      // Extracted metadata
    },
    "uploadedBy": "user_id",
    "uploadedAt": "2023-01-01T12:00:00Z",
    "lastAccessed": "2023-01-01T12:00:00Z",
    "tags": ["tag1", "tag2"],
    "status": "active",
    "createdAt": "2023-01-01T12:00:00Z",
    "updatedAt": "2023-01-01T12:00:00Z"
  }
  ```

### Download Document
- **Endpoint**: `GET /api/documents/:id/download`
- **Description**: Download a document file
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Response**: File download as attachment

### Update Document Permissions
- **Endpoint**: `PUT /api/documents/:id/permissions`
- **Description**: Grant permissions to a user or group for a document
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Request Body**:
  ```json
  {
    "granteeType": "user", // or "group", "role", "public"
    "granteeId": "user_id", // for user granteeType
    "granteeName": "group_name", // for group or public granteeType
    "permission": "read" // "read", "write", "delete", or "admin"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Permission granted successfully"
  }
  ```

### Get Document Permissions
- **Endpoint**: `GET /api/documents/:id/permissions`
- **Description**: Get all permissions for a document
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Response**:
  ```json
  [
    {
      "_id": "acl_entry_id",
      "resourceType": "document",
      "resourceId": "document_id",
      "granteeType": "user",
      "granteeId": "user_id",
      "granteeName": null,
      "permission": "admin",
      "grantedBy": {
        "username": "granting_user",
        "displayName": "Granting User"
      },
      "grantedAt": "2023-01-01T12:00:00Z",
      "expiresAt": null,
      "active": true,
      "createdAt": "2023-01-01T12:00:00Z",
      "updatedAt": "2023-01-01T12:00:00Z"
    }
  ]
  ```

### Delete Document
- **Endpoint**: `DELETE /api/documents/:id`
- **Description**: Mark a document as deleted (soft delete)
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Response**:
  ```json
  {
    "message": "Document deleted successfully"
  }
  ```

### Search Documents
- **Endpoint**: `POST /api/documents/search`
- **Description**: Search for documents based on various criteria
- **Headers**:
  - `Authorization: Bearer <jwt_token>`
- **Request Body**:
  ```json
  {
    "query": "search term",
    "tags": ["tag1", "tag2"],
    "uploadedBy": "user_id",
    "dateFrom": "2023-01-01",
    "dateTo": "2023-12-31"
  }
  ```
- **Response**:
  ```json
  [
    {
      "_id": "document_id",
      "name": "document_name.pdf",
      "size": 123456,
      "mimeType": "application/pdf",
      "uploadedAt": "2023-01-01T12:00:00Z",
      "lastAccessed": "2023-01-01T12:00:00Z",
      "uploadedBy": "user_id",
      "tags": ["tag1", "tag2"],
      "metadata": {
        // Extracted metadata
      }
    }
  ]
  ```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message"
}
```

## Permission System

Codex implements a matrix-based access control system with the following permissions:

- **read**: View document information and download
- **write**: Upload new versions of the document
- **delete**: Delete the document
- **admin**: Full control including permission management

Permissions can be granted to:
- Individual users
- LDAP/AD groups
- Public (any authenticated user)
- Roles (in future extensions)

The permission system follows a hierarchy where higher permissions include lower ones:
- admin includes delete, write, and read
- delete includes write and read
- write includes read