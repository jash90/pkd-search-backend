# Express Backend Service

This project provides an Express server that integrates with Qdrant and OpenAI services to process backend tasks. It takes a service description, generates an embedding, queries Qdrant for relevant data, and produces a chat prompt response using OpenAI's API.

## Features

- **Dynamic Embedding:** Uses the OpenAI API to generate embeddings for provided service descriptions.
- **Contextual Querying:** Retrieves relevant data by querying Qdrant with the generated embedding.
- **Chat Integration:** Constructs a chat prompt to obtain a response from OpenAI.
- **Robust Error Handling:** Implements error checks for missing environment variables and runtime exceptions.

## Prerequisites

- **Node.js:** Version 14 or higher is recommended.
- **Environment Variables:** Create a `.env` file at the project root with the following keys:
  - `QDRANT_URL` - URL for the Qdrant instance.
  - `QDRANT_API_KEY` - API key for Qdrant.
  - `OPENAI_API_KEY` - API key for OpenAI.
  - `PORT` - (Optional) Port number to run the server. Defaults to 3000 if not provided.

## Installation

1. **Clone the Repository:**

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Create `.env` File:**

   Create a `.env` file in the root directory and add:

   ```env
   QDRANT_URL=your_qdrant_url
   QDRANT_API_KEY=your_qdrant_api_key
   OPENAI_API_KEY=your_openai_api_key
   PORT=3000  # optional
   ```

## Usage

1. **Start the Server:**

   ```bash
   npm start
   ```

2. **Endpoint:**

   The server provides a single endpoint. You can test it by sending a GET request:

   ```http
   GET http://localhost:3000/process/<serviceDescription>
   ```

   Replace `<serviceDescription>` with your desired service description (URL encoded if necessary).

3. **Example Call:**

   ```bash
   curl http://localhost:3000/process/"Send%20service%20data"
   ```

## Error Handling

- If any required environment variable is missing, the server will log an appropriate error and terminate.
- The server uses a global error handling middleware to catch unexpected errors and return a consistent error response.

## License

This project is licensed under the MIT License. 