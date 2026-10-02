# Format Studio

Format Studio is a React web interface for formatting and previewing JSON,
HTML, XML, and Markdown documents with the `dev-utils` document API.

## Features

- Format JSON, HTML, XML, and Markdown using the backend API.
- Paste content into the editor or open a local file (`.json`, `.html`,
  `.htm`, `.xml`, `.md`, or `.markdown`).
- Edit the document filename before processing.
- View formatted source and, for HTML and Markdown, a rendered preview in a
  sandboxed frame.
- Browse JSON and XML results in a collapsible tree, with controls to expand or
  collapse all nested values; switch to Source at any time to see the formatted
  text.
- Decode JWTs into their header and payload, and inspect the signature and
  backend-reported verification status.
- Encode text as unpadded Base64 URL-safe text or decode Base64 URL-safe text.
- Copy the result or download the formatted document.
- Process documents up to 1 MiB.

The browser does not upload files directly from disk: the selected file's
contents are loaded into the editor and sent to the API when you choose
**Format document**.

## Requirements

- Node.js LTS, which includes npm.
- The `dev-utils` backend running locally or at another reachable URL.

On Windows, install Node.js LTS from PowerShell with:

```powershell
winget install OpenJS.NodeJS.LTS
```

After installation, close and reopen the terminal (and VS Code if necessary),
then verify the commands are available:

```powershell
node --version
npm --version
```

If Node.js is installed but PowerShell still cannot find `node`, add the
usual installation folder to the current terminal's PATH:

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
node --version
npm.cmd --version
```

The PATH change above applies only to that terminal. If `npm` does not run as
a PowerShell command, use `npm.cmd` in the commands below.

## Run the app locally

Open PowerShell in the project directory, then copy the sample environment
file, install frontend dependencies, and start Vite:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

If needed, substitute `npm.cmd` for `npm`:

```powershell
npm.cmd install
npm.cmd run dev
```

Keep the terminal running and open the local URL printed by Vite. It is
usually `http://localhost:5173`.

The frontend and backend are separate processes. Start the backend separately
and leave it running while using the UI. The default backend URL is
`http://127.0.0.1:8000`.

## API connection configuration

The frontend uses the configured API base URL for the following JSON `POST`
endpoints:

```text
http://127.0.0.1:8000/documents/process
http://127.0.0.1:8000/utilities/jwt/decode
http://127.0.0.1:8000/utilities/base64/url/encode
http://127.0.0.1:8000/utilities/base64/url/decode
```

The document formatter sends `fileName`, `content`, and `contentType`. The
content type is selected based on the chosen format: `application/json`,
`text/html`, `application/xml`, or `text/markdown`. The utility tools send:

| Tool | Request JSON | Result |
| --- | --- | --- |
| JWT decode | `{ "token": "..." }` | Decoded header, payload, signature, and `verified` status |
| Base64 URL encode | `{ "text": "..." }` | Unpadded URL-safe Base64 in `encoded` |
| Base64 URL decode | `{ "encoded": "..." }` | Decoded text in `decoded` |

JWT decoding sends the token to the configured API and is **not verification**:
it does not establish that a token's signature is valid or that its claims
should be trusted. Do not send real credentials to an API you do not trust or
treat decoded contents as authenticated.

Set the API **base URL** in `.env` to change the backend address:

```dotenv
VITE_DOCUMENT_API_URL=http://127.0.0.1:8000
```

The frontend adds the appropriate endpoint path to the base URL. A full
endpoint URL saved in connection settings is also recognized and its path is
replaced with the selected tool's path. If you edit `.env`, restart the Vite
dev server for the change to take effect. Do not include credentials or
secrets in this frontend environment variable; Vite variables are included in
the browser app.

You can also set the base URL in the app's **Connection settings**. This
browser-specific setting is saved in local storage and takes precedence over
`.env`. Clear the saved connection setting in the browser if you want the app
to use the environment-configured URL again.

The backend must allow requests from the Vite app's origin through CORS.
Calling the API successfully from a terminal does not by itself verify browser
CORS access.

## Test the backend

With the backend running at the default address, send the sample request from
PowerShell:

```powershell
curl.exe -X POST "http://127.0.0.1:8000/documents/process" `
  -H "Content-Type: application/json" `
  -d '{ "fileName": "notes.md", "content": "# Hello" }'
```

The response includes the filename, detected format, formatted content,
preview HTML, and input character count. You can also test end-to-end by entering content in the UI, selecting a tool,
and using its action button.

## Build and preview

Create a production build:

```powershell
npm run build
```

To serve the production build locally:

```powershell
npm run preview
```

Vite prints the local preview URL in the terminal. The preview server is for
checking the built frontend; the backend must still be running separately.
