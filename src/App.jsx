import React, { useMemo, useRef, useState } from 'react';
import {
  Braces,
  Check,
  ChevronDown,
  CircleAlert,
  Clipboard,
  Code2,
  Download,
  Expand,
  FileCode2,
  FileJson,
  FileText,
  FileUp,
  LoaderCircle,
  PanelTop,
  Shrink,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

const API_PATH = '/documents/process';
const UTILITY_PATHS = {
  jwtDecode: '/utilities/jwt/decode',
  base64Encode: '/utilities/base64/url/encode',
  base64Decode: '/utilities/base64/url/decode',
};
const MAX_BYTES = 1_048_576;
const FORMATS = [
  { id: 'json', label: 'JSON', extension: 'json', icon: Braces },
  { id: 'html', label: 'HTML', extension: 'html', icon: Code2 },
  { id: 'xml', label: 'XML', extension: 'xml', icon: FileCode2 },
  { id: 'markdown', label: 'Markdown', extension: 'md', icon: FileText },
];
const CONTENT_TYPES = {
  json: 'application/json',
  html: 'text/html',
  xml: 'application/xml',
  markdown: 'text/markdown',
};
const DEFAULT_API_URL = import.meta.env.VITE_DOCUMENT_API_URL ?? 'http://127.0.0.1:8000';

function getInitialApiUrl() {
  try {
    return localStorage.getItem('format-studio-api-url') || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

function getEndpoint(url, path = API_PATH) {
  let baseUrl = url.trim().replace(/\/+$/, '');
  for (const endpointPath of [API_PATH, ...Object.values(UTILITY_PATHS)]) {
    if (baseUrl.endsWith(endpointPath)) {
      baseUrl = baseUrl.slice(0, -endpointPath.length);
      break;
    }
  }
  return `${baseUrl}${path}`;
}

function getPreviewDocument(markup) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;padding:28px;color:#26332d;background:#fff;font:15px/1.65 Georgia,serif;overflow-wrap:anywhere}
    h1,h2,h3,h4,h5,h6{font-family:Arial,sans-serif;line-height:1.2;margin:1.4em 0 .55em}h1{margin-top:0}
    p,ul,ol,blockquote,pre,table{margin:0 0 1em}a{color:#176a4b}blockquote{border-left:3px solid #c9d6cc;padding-left:16px;color:#52635a}
    pre,code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#f2f5f1}pre{padding:14px;white-space:pre-wrap;border-radius:4px}
    code{padding:2px 4px;border-radius:3px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dce3dd;padding:8px 10px;text-align:left}
    img{max-width:100%;height:auto}hr{border:0;border-top:1px solid #dce3dd;margin:24px 0}
  </style></head><body>${markup}</body></html>`;
}

function createJsonTree(value, label = '$', id = 'json-root') {
  if (Array.isArray(value)) {
    const children = value.map((item, index) => createJsonTree(item, `[${index}]`, `${id}-${index}`));
    return {
      id,
      label,
      opening: '[',
      closing: ']',
      children,
      value: children.length ? undefined : '[]',
    };
  }

  if (value !== null && typeof value === 'object') {
    const children = Object.entries(value).map(([key, item], index) => (
      createJsonTree(item, `${JSON.stringify(key)}:`, `${id}-${index}`)
    ));
    return {
      id,
      label,
      opening: '{',
      closing: '}',
      children,
      value: children.length ? undefined : '{}',
    };
  }

  return {
    id,
    label,
    value: JSON.stringify(value),
    valueType: value === null ? 'null' : typeof value,
  };
}

function createXmlTree(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parseError = document.querySelector('parsererror');
  if (parseError) throw new Error(parseError.textContent || 'The XML could not be parsed.');

  function createNode(node, id) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const attributes = Array.from(node.attributes, (attribute) => (
        ` ${attribute.name}="${attribute.value}"`
      )).join('');
      const children = Array.from(node.childNodes)
        .filter((child) => child.nodeType !== Node.TEXT_NODE || child.nodeValue.trim())
        .map((child, index) => createNode(child, `${id}-${index}`));
      return {
        id,
        label: `<${node.nodeName}${attributes}${children.length ? '>' : ' />'}`,
        closing: children.length ? `</${node.nodeName}>` : '',
        children,
      };
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return { id, label: node.nodeValue, valueType: 'text' };
    }

    if (node.nodeType === Node.CDATA_SECTION_NODE) {
      return { id, label: `<![CDATA[${node.nodeValue}]]>`, valueType: 'text' };
    }

    if (node.nodeType === Node.COMMENT_NODE) {
      return { id, label: `<!-- ${node.nodeValue} -->`, valueType: 'text' };
    }

    if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
      return { id, label: `<?${node.nodeName} ${node.nodeValue}?>`, valueType: 'text' };
    }

    if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
      return { id, label: `<!DOCTYPE ${node.nodeName}>`, valueType: 'text' };
    }

    return { id, label: node.nodeName, valueType: 'text' };
  }

  return {
    id: 'xml-root',
    label: 'XML document',
    children: Array.from(document.childNodes)
      .filter((node) => node.nodeType !== Node.TEXT_NODE || node.nodeValue.trim())
      .map((node, index) => createNode(node, `xml-${index}`)),
  };
}

function collectBranchIds(node) {
  if (!node.children?.length) return [];
  return [node.id, ...node.children.flatMap(collectBranchIds)];
}

function TreeNode({ node, expandedNodes, setExpandedNodes }) {
  const isBranch = Boolean(node.children?.length);
  const isExpanded = expandedNodes[node.id] ?? true;

  return (
    <div className="tree-node">
      <div className="tree-row">
        {isBranch ? (
          <button
            className="tree-toggle"
            type="button"
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.label}`}
            aria-expanded={isExpanded}
            onClick={() => setExpandedNodes((current) => ({ ...current, [node.id]: !isExpanded }))}
          >
            {isExpanded ? '-' : '+'}
          </button>
        ) : <span className="tree-toggle-placeholder" />}
        <span className={`tree-label ${node.valueType ? `tree-value-${node.valueType}` : ''}`}>{node.label}</span>
        {node.opening && <span className="tree-delimiter">{node.opening}</span>}
        {node.value !== undefined && <span className={`tree-value tree-value-${node.valueType || 'container'}`}>{node.value}</span>}
        {isBranch && !isExpanded && <span className="tree-summary">... {node.closing}</span>}
      </div>
      {isBranch && isExpanded && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expandedNodes={expandedNodes}
              setExpandedNodes={setExpandedNodes}
            />
          ))}
          {node.closing && <div className="tree-closing">{node.closing}</div>}
        </div>
      )}
    </div>
  );
}

function App() {
  const [toolMode, setToolMode] = useState('format');
  const [format, setFormat] = useState('json');
  const [fileName, setFileName] = useState('untitled.json');
  const [content, setContent] = useState('');
  const [result, setResult] = useState(null);
  const [outputMode, setOutputMode] = useState('tree');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl);
  const [endpointDraft, setEndpointDraft] = useState(getInitialApiUrl);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef(null);

  const byteCount = new TextEncoder().encode(content).length;
  const activeFormat = FORMATS.find((item) => item.id === format);
  const isFormatter = toolMode === 'format';
  const supportsTree = isFormatter && (format === 'json' || format === 'xml');
  const supportsPreview = isFormatter && (format === 'html' || format === 'markdown');
  const toolDetails = {
    format: { label: `${activeFormat.label} formatter`, input: `Unformatted ${activeFormat.label} content`, placeholder: `Paste your ${activeFormat.label} here...` },
    jwtDecode: { label: 'JWT decoder', input: 'JWT token', placeholder: 'Paste a JWT to decode...' },
    base64Encode: { label: 'Base64 URL encoder', input: 'Text to encode', placeholder: 'Enter text to Base64 URL-encode...' },
    base64Decode: { label: 'Base64 URL decoder', input: 'Base64 text to decode', placeholder: 'Paste Base64 URL-encoded text...' },
  }[toolMode];
  const structuredTree = useMemo(() => {
    if (!result || !supportsTree) return null;
    try {
      return {
        tree: format === 'json'
          ? createJsonTree(JSON.parse(result.formattedContent))
          : createXmlTree(result.formattedContent),
        error: '',
      };
    } catch (treeError) {
      return {
        tree: null,
        error: treeError instanceof Error ? treeError.message : 'Could not parse the formatted document.',
      };
    }
  }, [format, result, supportsTree]);

  function updateContent(value) {
    setContent(value);
    setResult(null);
    setError('');
    setNotice('');
  }

  function selectFormat(nextFormat) {
    setToolMode('format');
    setFormat(nextFormat);
    setFileName((current) => {
      const baseName = current.replace(/\.[^.]+$/, '') || 'untitled';
      const extension = FORMATS.find((item) => item.id === nextFormat).extension;
      return `${baseName}.${extension}`;
    });
    setResult(null);
    setError('');
    setOutputMode(nextFormat === 'html' || nextFormat === 'markdown' ? 'preview' : 'tree');
  }

  function selectTool(nextTool) {
    setToolMode(nextTool);
    setResult(null);
    setError('');
    setNotice('');
    setOutputMode(nextTool === 'format'
      ? (format === 'html' || format === 'markdown' ? 'preview' : 'tree')
      : 'source');
  }

  async function processDocument() {
    setError('');
    setNotice('');
    if (!content.trim()) {
      setError(`Add some content before using the ${toolDetails.label}.`);
      return;
    }
    if (!apiUrl.trim()) {
      setError('Set your dev-utils API URL in connection settings first.');
      setSettingsOpen(true);
      return;
    }
    if (byteCount > MAX_BYTES) {
      setError('This input is over the 1 MiB limit.');
      return;
    }

    setBusy(true);
    setResult(null);
    setExpandedNodes({});
    try {
      const isUtility = toolMode !== 'format';
      const path = isUtility ? UTILITY_PATHS[toolMode] : API_PATH;
      const body = toolMode === 'jwtDecode'
        ? { token: content }
        : toolMode === 'base64Encode'
          ? { text: content }
          : toolMode === 'base64Decode'
            ? { encoded: content }
            : { fileName, content, contentType: CONTENT_TYPES[format] };
      const response = await fetch(getEndpoint(apiUrl, path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const responseText = await response.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = {};
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('The API tunnel denied access. Authenticate with GitHub or make the forwarded API port accessible to this app.');
        }
        throw new Error(payload.error || `Request failed (${response.status}).`);
      }
      if (!responseText) throw new Error('The API returned an empty response.');
      if (toolMode === 'jwtDecode') {
        if (
          !payload
          || typeof payload !== 'object'
          || !('header' in payload)
          || !('payload' in payload)
          || typeof payload.signature !== 'string'
          || typeof payload.verified !== 'boolean'
        ) {
          throw new Error('The API response did not include the expected decoded JWT fields.');
        }
        setResult({
          formattedContent: JSON.stringify(payload, null, 2),
          fileName: 'decoded-jwt.json',
          characterCount: content.length,
        });
        setOutputMode('source');
      } else if (toolMode === 'base64Encode' || toolMode === 'base64Decode') {
        const output = toolMode === 'base64Encode' ? payload.encoded : payload.decoded;
        if (typeof output !== 'string') throw new Error('The API response did not include the expected output.');
        setResult({
          formattedContent: output,
          fileName: toolMode === 'base64Encode' ? 'encoded.txt' : 'decoded.txt',
          characterCount: content.length,
        });
        setOutputMode('source');
      } else {
        setResult(payload);
        setOutputMode(format === 'html' || format === 'markdown' ? 'preview' : 'tree');
      }
      setNotice(isUtility ? `${toolDetails.label} complete` : 'Document processed');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reach the dev-utils API.');
    } finally {
      setBusy(false);
    }
  }

  async function copyOutput() {
    if (!result) return;
    const value = outputMode === 'preview' ? result.previewHtml : result.formattedContent;
    try {
      await navigator.clipboard.writeText(value);
      setNotice(outputMode === 'preview' ? 'Preview markup copied' : isFormatter ? 'Formatted source copied' : 'Result copied');
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  }

  function downloadOutput() {
    if (!result) return;
    const blob = new Blob([result.formattedContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = result.fileName || fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice('File downloaded');
  }

  function saveEndpoint() {
    const nextUrl = endpointDraft.trim();
    setApiUrl(nextUrl);
    try {
      if (nextUrl) localStorage.setItem('format-studio-api-url', nextUrl);
      else localStorage.removeItem('format-studio-api-url');
    } catch {
      setError('Could not save the API URL in this browser.');
    }
    setSettingsOpen(false);
    setNotice(nextUrl ? 'API endpoint saved' : 'API endpoint cleared');
  }

  async function loadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const matchingFormat = FORMATS.find((item) => item.extension === extension || (item.id === 'markdown' && extension === 'markdown'));
    if (!matchingFormat) {
      setError('Choose a JSON, HTML, XML, or Markdown file.');
      event.target.value = '';
      return;
    }
    setFileName(file.name);
    setFormat(matchingFormat.id);
    setContent(await file.text());
    setResult(null);
    setError('');
    setOutputMode(matchingFormat.id === 'html' || matchingFormat.id === 'markdown' ? 'preview' : 'tree');
    event.target.value = '';
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Format Studio home">
          <span className="brand-mark"><Braces size={20} strokeWidth={2.2} /></span>
          <span>format<span className="brand-light">studio</span></span>
        </a>
        <div className="topbar-right">
          <span className={`connection-status ${apiUrl.trim() ? 'is-connected' : ''}`}>
            <span className="status-dot" />
            {apiUrl.trim() ? 'API configured' : 'API not configured'}
          </span>
          <button className="icon-button top-settings" type="button" aria-label="Connection settings" title="Connection settings" onClick={() => { setEndpointDraft(apiUrl); setSettingsOpen((open) => !open); }}>
            <Settings2 size={17} />
          </button>
        </div>
        {settingsOpen && (
          <section className="settings-popover" aria-label="Connection settings">
            <div className="popover-heading">
              <div><span className="eyebrow">CONNECTION</span><h2>API endpoint</h2></div>
              <button className="icon-button close-settings" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={17} /></button>
            </div>
            <label className="field-label" htmlFor="api-url">Base URL or full endpoint</label>
            <input id="api-url" className="endpoint-input" type="url" placeholder="https://your-api.execute-api.region.amazonaws.com/Prod" value={endpointDraft} onChange={(event) => setEndpointDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEndpoint(); }} />
            <p className="field-hint">The app sends requests to <code>/documents/process</code>. Saved only in this browser.</p>
            <div className="popover-actions">
              <button className="text-button" type="button" onClick={() => { setEndpointDraft(''); }}>Clear</button>
              <button className="button button-small button-primary" type="button" onClick={saveEndpoint}>Save endpoint</button>
            </div>
          </section>
        )}
      </header>

      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">DEVELOPER TOOLKIT <span className="eyebrow-rule" /></div>
            <h1>Format <span>Studio</span></h1>
          </div>
          <div className="format-count"><span>04</span> FORMATS</div>
        </div>

        <nav className="format-tabs" aria-label="Developer tools">
          {FORMATS.map(({ id, label, icon: Icon }) => (
            <button className={`format-tab ${isFormatter && format === id ? 'active' : ''}`} type="button" key={id} aria-pressed={isFormatter && format === id} onClick={() => selectFormat(id)}>
              <Icon size={16} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          ))}
          <span className="tool-divider" />
          <button className={`utility-tab ${toolMode === 'jwtDecode' ? 'active' : ''}`} type="button" aria-pressed={toolMode === 'jwtDecode'} onClick={() => selectTool('jwtDecode')}>JWT decode</button>
          <button className={`utility-tab ${toolMode === 'base64Encode' ? 'active' : ''}`} type="button" aria-pressed={toolMode === 'base64Encode'} onClick={() => selectTool('base64Encode')}>Base64 encode</button>
          <button className={`utility-tab ${toolMode === 'base64Decode' ? 'active' : ''}`} type="button" aria-pressed={toolMode === 'base64Decode'} onClick={() => selectTool('base64Decode')}>Base64 decode</button>
          {isFormatter && <span className="tabs-spacer" />}
          {isFormatter && (
            <>
              <button className="subtle-action upload-action" type="button" onClick={() => fileInputRef.current?.click()}>
                <FileUp size={15} /><span>Open file</span>
              </button>
              <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,.html,.htm,.xml,.md,.markdown" onChange={loadFile} />
            </>
          )}
        </nav>

        <section className="editor-grid" aria-label={toolDetails.label}>
          <article className="editor-panel input-panel">
            <div className="panel-heading">
              <div className="panel-title-group">
                <span className="panel-index">01</span>
                <h2>Input</h2>
                <span className="panel-caption">{isFormatter ? 'Paste or write your document' : toolDetails.label}</span>
              </div>
              <div className="panel-tools">
                <button className="icon-button" type="button" aria-label="Clear input" title="Clear input" onClick={() => { updateContent(''); setFileName(`untitled.${activeFormat.extension}`); }} disabled={!content}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="document-bar">
              {isFormatter
                ? <div className="filename-wrap"><FileJson size={15} /><input aria-label="Document filename" value={fileName} onChange={(event) => setFileName(event.target.value)} /></div>
                : <span className="utility-input-label">{toolDetails.input}</span>}
              <span className="format-chip">{isFormatter ? activeFormat.label : toolMode === 'jwtDecode' ? 'JWT' : 'BASE64 URL'}</span>
            </div>
            <label className="visually-hidden" htmlFor="document-input">{toolDetails.input}</label>
            <textarea
              id="document-input"
              className="code-input"
              spellCheck="false"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={toolDetails.placeholder}
              value={content}
              onChange={(event) => updateContent(event.target.value)}
            />
            <div className="editor-footer">
              <span className={byteCount > MAX_BYTES ? 'size-warning' : ''}>{byteCount.toLocaleString()} bytes <span className="footer-divider">/</span> 1 MiB</span>
              <span>{content.length.toLocaleString()} characters</span>
            </div>
            {toolMode === 'jwtDecode' && <p className="utility-warning">The token is sent to the configured API. Decoding does not verify its signature or validate claims.</p>}
          </article>

          <div className="process-rail" aria-hidden="true"><span><ChevronDown size={17} /></span></div>

          <article className="editor-panel output-panel">
            <div className="panel-heading output-heading">
              <div className="panel-title-group">
                <span className="panel-index">02</span>
                <h2>Result</h2>
                {result && <span className="success-label"><Check size={12} /> Ready</span>}
              </div>
              <div className="panel-tools output-tools">
                <button className="icon-button" type="button" aria-label="Copy result" title="Copy result" onClick={copyOutput} disabled={!result}><Clipboard size={15} /></button>
                <button className="icon-button" type="button" aria-label="Download formatted file" title="Download formatted file" onClick={downloadOutput} disabled={!result}><Download size={15} /></button>
              </div>
            </div>
            <div className="result-bar">
              <div className="view-switch" role="tablist" aria-label="Result view">
                {supportsPreview && <button className={outputMode === 'preview' ? 'selected' : ''} type="button" role="tab" aria-selected={outputMode === 'preview'} onClick={() => setOutputMode('preview')}><PanelTop size={14} /> Preview</button>}
                <button className={outputMode === 'source' ? 'selected' : ''} type="button" role="tab" aria-selected={outputMode === 'source'} onClick={() => setOutputMode('source')}><Code2 size={14} /> Source</button>
                {supportsTree && <button className={outputMode === 'tree' ? 'selected' : ''} type="button" role="tab" aria-selected={outputMode === 'tree'} onClick={() => setOutputMode('tree')}><Braces size={14} /> Tree</button>}
              </div>
              {outputMode === 'tree' && result && structuredTree?.tree ? (
                <div className="tree-actions">
                  <button type="button" onClick={() => setExpandedNodes(Object.fromEntries(collectBranchIds(structuredTree.tree).map((id) => [id, true])))}>
                    <Expand size={12} /> Expand all
                  </button>
                  <button type="button" onClick={() => setExpandedNodes(Object.fromEntries(collectBranchIds(structuredTree.tree).map((id) => [id, false])))}>
                    <Shrink size={12} /> Collapse all
                  </button>
                </div>
              ) : (
                <span className="result-type">{outputMode === 'preview' ? 'RENDERED VIEW' : outputMode === 'tree' ? 'STRUCTURED TREE' : isFormatter ? 'FORMATTED SOURCE' : 'UTILITY OUTPUT'}</span>
              )}
            </div>
            <div className={`result-content ${outputMode === 'preview' ? 'preview-content' : ''}`}>
              {result ? (
                supportsPreview && outputMode === 'preview' ? (
                  <iframe className="preview-frame" title={`${activeFormat.label} rendered preview`} sandbox="" srcDoc={getPreviewDocument(result.previewHtml)} />
                ) : outputMode === 'tree' && supportsTree ? (
                  structuredTree.error ? (
                    <div className="tree-error">Could not display the tree: {structuredTree.error}. Switch to Source to view the formatted text.</div>
                  ) : (
                    <div className="structured-tree">
                      <TreeNode node={structuredTree.tree} expandedNodes={expandedNodes} setExpandedNodes={setExpandedNodes} />
                    </div>
                  )
                ) : (
                  <pre className="code-output"><code>{result.formattedContent}</code></pre>
                )
              ) : (
                <div className="empty-result">
                  <div className="empty-icon"><Sparkles size={19} /></div>
                  <p>Your formatted document<br />will appear here</p>
                  <span>Ready when you are</span>
                </div>
              )}
              {busy && <div className="loading-overlay"><LoaderCircle size={23} className="spinner" /><span>Processing {toolDetails.label}...</span></div>}
            </div>
            <div className="editor-footer result-footer">
              <span>{result ? `${(result.characterCount ?? 0).toLocaleString()} input characters` : 'Output will appear here'}</span>
              <span className="result-footer-mark">FORMAT STUDIO <span>•</span></span>
            </div>
          </article>
        </section>

        <div className="action-row">
          <div className="feedback" aria-live="polite">
            {error ? <><CircleAlert size={15} /><span>{error}</span></> : notice ? <><Check size={15} /><span>{notice}</span></> : <span className="quiet-feedback">{toolMode === 'jwtDecode' ? 'JWT decode does not verify the signature' : toolMode === 'base64Encode' ? 'Encodes as unpadded Base64 URL-safe text' : toolMode === 'base64Decode' ? 'Decodes Base64 URL-safe text' : supportsPreview ? 'Preview is isolated in a sandbox' : 'Source is formatted by the dev-utils API'}</span>}
          </div>
          <button className="button button-primary process-button" type="button" onClick={processDocument} disabled={busy || !content.trim()}>
            {busy ? <LoaderCircle size={16} className="spinner" /> : <Sparkles size={16} />}
            <span>{busy ? 'Processing...' : isFormatter ? 'Format document' : toolDetails.label}</span>
          </button>
        </div>
        <div className="workspace-bottom"><span>JSON <i /> HTML <i /> XML <i /> MARKDOWN</span><span>LOCAL INPUT <i /> NO FILES STORED</span></div>
      </main>
    </div>
  );
}

export default App;