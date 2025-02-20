# PKD Code Service

A Node.js service that provides PKD (Polish Classification of Activities) code suggestions based on service descriptions, using vector similarity search (Qdrant) and AI (OpenAI).

## Features

- **Service Description → PKD Code Matching**: Uses Qdrant for vector similarity queries to suggest relevant PKD codes.  
- **AI-Powered Suggestions**: Integrates with OpenAI GPT-4 to generate detailed suggestions based on service descriptions.  
- **PostgreSQL Caching**: Stores Qdrant query results and AI suggestion responses in PostgreSQL tables (`cache`, `aiCache`) for quick retrieval.  
- **Express.js REST API**: Provides endpoints to retrieve PKD code data, AI suggestions, or both.

## Prerequisites

1. **Node.js (v14+ recommended)**  
2. **A running Qdrant instance** with a valid API key (`QDRANT_URL` and `QDRANT_API_KEY`).  
3. **OpenAI API access** (`OPENAI_API_KEY`).  
4. **PostgreSQL database** for caching (`DATABASE_URL`).  

## Environment Variables

Create a `.env` file at the root of your project with the following fields:

```env
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=postgresql://user:password@host:port/dbname

PORT=3000    # optional, defaults to 3000
```

- **QDRANT_URL**: URL of your Qdrant instance  
- **QDRANT_API_KEY**: API key for Qdrant  
- **OPENAI_API_KEY**: API key for OpenAI  
- **DATABASE_URL**: PostgreSQL connection string indicating your database  
- **PORT**: Port on which you want the server to run  

On startup, the service will automatically create the `cache` and `aiCache` tables in the specified PostgreSQL database.

## Installation and Setup

1. **Clone the Repository** (or download the source code).
2. **Install Dependencies**:
    ```bash
    npm install
    ```
3. **Create `.env` File**:
    ```bash
    cp .env.example .env
    # Set the variables in .env according to your environment
    ```
4. **Start the Service**:
    ```bash
    npm start
    ```
   The server will be available at http://localhost:3000 by default.

## Usage

### 1. Endpoint: `/process/`

**Method**: GET

**Query Parameters**:

- `serviceDescription` *(required)*: The description for which you want PKD code suggestions.  
- `onlyDatabase` *(optional)*: If this parameter is present (e.g., `onlyDatabase=true`), the endpoint returns **only** the PKD code data from Qdrant (cached or fresh).  
- `onlyAi` *(optional)*: If this parameter is present (e.g., `onlyAi=true`), the endpoint returns **only** the AI suggestion.  

**Response**:
```json
{
  "data": {
    "pkdCodeData": [...],      // Only returned if `onlyAi` is NOT set
    "aiSuggestion": "..."      // Only returned if `onlyDatabase` is NOT set
  }
}
```

**Example Requests**:

1. **Full Data** (both PKD code data and AI suggestion):
   ```bash
   curl "http://localhost:3000/process/?serviceDescription=Your%20Service%20Desc"
   ```
2. **Only Database**:
   ```bash
   curl "http://localhost:3000/process/?serviceDescription=Your%20Service%20Desc&onlyDatabase=true"
   ```
3. **Only AI**:
   ```bash
   curl "http://localhost:3000/process/?serviceDescription=Your%20Service%20Desc&onlyAi=true"
   ```

## Caching Details

The service uses **PostgreSQL** to cache:

1. **Qdrant Query Results** in a table named `cache`:
   - `serviceDescription` (primary key)  
   - `pkdCodeData` (JSON string)  

2. **AI Suggestion Responses** in a table named `aiCache`:
   - `serviceDescription` (primary key)  
   - `aiSuggestion` (text containing the AI response)  

When you make repeated calls with the same `serviceDescription`, the service will retrieve data from the database rather than making a new query to Qdrant or OpenAI.

## Error Handling

- **Missing .env Variables**: The service checks for required variables (`QDRANT_URL`, `QDRANT_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`) and exits if they are not present.  
- **PostgreSQL**: Logs any connection or query errors.  
- **Global Error Middleware**: Returns a 500 status code if an error is unhandled.

## Contributing

1. Fork the repo and create a new branch for your changes.
2. Test extensively before creating a pull request.

## License

This project is licensed under the [MIT License](./LICENSE). 