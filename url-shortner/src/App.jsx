import React, { useState, useEffect } from 'react';

// Required Logger Class
class Logger {
  constructor(name) {
    this.name = name;
  }
  
  info(msg, data) { 
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] INFO: ${msg}`, data || ''); 
  }
  
  error(msg, data) { 
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] ERROR: ${msg}`, data || ''); 
  }
  
  warn(msg, data) { 
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] WARN: ${msg}`, data || ''); 
  }
}

// URL Manager Class
class URLManager {
  constructor() {
    this.logger = new Logger('URLManager');
    
    if (!window.urlDatabase) {
      window.urlDatabase = [];
      this.logger.info('URL database initialized');
    }
  }

  generateShortcode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  isValidUrl(url) {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  isValidShortcode(code) {
    return /^[a-zA-Z0-9]{1,10}$/.test(code);
  }

  isExpired(urlData) {
    return Date.now() > urlData.expires;
  }

  isShortcodeUnique(code) {
    return !window.urlDatabase.some(url => url.code === code && !this.isExpired(url));
  }

  createShortUrl(originalUrl, minutes = 30, customCode = null) {
    this.logger.info('Creating short URL', { originalUrl, minutes, customCode });

    // Validation
    if (!this.isValidUrl(originalUrl)) {
      this.logger.error('Invalid URL format', { originalUrl });
      throw new Error('URL must start with http:// or https://');
    }

    if (!Number.isInteger(minutes) || minutes <= 0) {
      this.logger.error('Invalid validity period', { minutes });
      throw new Error('Validity must be a positive integer');
    }

    let shortcode = customCode;
    
    if (customCode) {
      if (!this.isValidShortcode(customCode)) {
        this.logger.error('Invalid custom shortcode', { customCode });
        throw new Error('Shortcode must be alphanumeric and 1-10 characters');
      }
      
      if (!this.isShortcodeUnique(customCode)) {
        this.logger.error('Shortcode collision', { customCode });
        throw new Error('Shortcode already exists');
      }
    } else {
      do {
        shortcode = this.generateShortcode();
      } while (!this.isShortcodeUnique(shortcode));
    }

    const urlData = {
      id: Date.now() + Math.random(),
      originalUrl,
      shortcode,
      created: Date.now(),
      expires: Date.now() + (minutes * 60000),
      clicks: 0
    };

    window.urlDatabase.push(urlData);
    this.logger.info('Short URL created successfully', urlData);
    return urlData;
  }

  getUrlByShortcode(code) {
    const urlData = window.urlDatabase.find(url => url.shortcode === code);
    
    if (!urlData) {
      this.logger.warn('Shortcode not found', { code });
      return null;
    }

    if (this.isExpired(urlData)) {
      this.logger.warn('URL expired', { code });
      return null;
    }

    return urlData;
  }

  incrementClicks(code) {
    const urlData = window.urlDatabase.find(url => url.shortcode === code);
    if (urlData) {
      urlData.clicks++;
      this.logger.info('Click recorded', { code, clicks: urlData.clicks });
    }
  }

  getAllActiveUrls() {
    return window.urlDatabase.filter(url => !this.isExpired(url));
  }
}

// Router Hook
function useSimpleRouter() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  return { currentPath, navigate };
}

function App() {
  const [page, setPage] = useState('home');
  const [urls, setUrls] = useState([{ url: '', minutes: 30, code: '' }]);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const { currentPath, navigate } = useSimpleRouter();
  const manager = new URLManager();
  const logger = new Logger('App');

  // Handle URL routing and redirection
  useEffect(() => {
    logger.info('App initialized');
    
    const path = currentPath;
    
    if (path === '/statistics') {
      setPage('statistics');
    } else if (path !== '/' && path.length > 1) {
      // Extract shortcode from URL path
      const shortcode = path.substring(1);
      logger.info('Attempting redirect for shortcode', { shortcode, path, allUrls: window.urlDatabase });
      
      const urlData = manager.getUrlByShortcode(shortcode);
      
      if (urlData) {
        manager.incrementClicks(shortcode);
        logger.info('Redirecting to original URL', { shortcode, originalUrl: urlData.originalUrl });
        
        // Show redirect message briefly, then redirect
        alert(`Redirecting to: ${urlData.originalUrl}`);
        setTimeout(() => {
          window.location.href = urlData.originalUrl;
        }, 1000);
      } else {
        logger.warn('Shortcode not found or expired', { 
          shortcode, 
          allCodes: window.urlDatabase.map(u => u.shortcode),
          totalUrls: window.urlDatabase.length 
        });
        alert(`Link not found or expired. Shortcode: ${shortcode}`);
        navigate('/');
        setPage('home');
      }
    } else {
      setPage('home');
    }
  }, [currentPath]);

  // Navigation handler
  const handleNavigation = (targetPage) => {
    logger.info('Navigation triggered', { from: page, to: targetPage });
    setPage(targetPage);
    
    if (targetPage === 'home') {
      navigate('/');
    } else if (targetPage === 'statistics') {
      navigate('/statistics');
    }
  };

  // Add URL field (max 5)
  const addUrlField = () => {
    if (urls.length < 5) {
      const newUrls = [...urls, { url: '', minutes: 30, code: '' }];
      setUrls(newUrls);
      logger.info('URL field added', { totalFields: newUrls.length });
    }
  };

  // Remove URL field
  const removeUrlField = (index) => {
    if (urls.length > 1) {
      const newUrls = urls.filter((_, i) => i !== index);
      setUrls(newUrls);
      logger.info('URL field removed', { index, remainingFields: newUrls.length });
    }
  };

  // Update URL field
  const updateUrlField = (index, field, value) => {
    const newUrls = [...urls];
    if (field === 'minutes') {
      newUrls[index][field] = parseInt(value) || 30;
    } else {
      newUrls[index][field] = value;
    }
    setUrls(newUrls);
  };

  // Validate and create URLs
  const createShortUrls = () => {
    setLoading(true);
    setErrors([]);
    const createdUrls = [];
    const validationErrors = [];

    logger.info('Starting URL creation process', { urlCount: urls.length });

    urls.forEach((urlInput, index) => {
      if (!urlInput.url.trim()) return; // Skip empty URLs
      
      try {
        const result = manager.createShortUrl(
          urlInput.url.trim(),
          urlInput.minutes,
          urlInput.code.trim() || null
        );
        createdUrls.push(result);
      } catch (error) {
        logger.error('URL creation failed', { index, error: error.message });
        validationErrors[index] = error.message;
      }
    });

    setResults(createdUrls);
    setErrors(validationErrors);
    
    if (createdUrls.length > 0) {
      logger.info('URLs created successfully', { count: createdUrls.length });
      // Reset form for successful creations
      setUrls([{ url: '', minutes: 30, code: '' }]);
      
      // Clear errors if all succeeded
      if (validationErrors.length === 0) {
        setErrors([]);
      }
    }
    
    setLoading(false);
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      logger.info('URL copied to clipboard', { url: text });
      alert('URL copied to clipboard!');
    }).catch(() => {
      logger.error('Failed to copy to clipboard');
      alert('Failed to copy URL');
    });
  };

  // Handle short URL click (for testing)
  const handleShortUrlClick = (shortcode, originalUrl) => {
    logger.info('Short URL clicked', { shortcode });
    manager.incrementClicks(shortcode);
    
    // Update results to reflect new click count
    setResults(prevResults => 
      prevResults.map(result => 
        result.shortcode === shortcode 
          ? { ...result, clicks: result.clicks + 1 }
          : result
      )
    );
    
    // For demo purposes - simulate the redirect that would happen
    const confirmRedirect = window.confirm(`This will redirect to:\n${originalUrl}\n\nClick OK to continue or Cancel to stay here.`);
    if (confirmRedirect) {
      window.open(originalUrl, '_blank');
    }
  };

  // Render current page content
  const renderPageContent = () => {
    if (page === 'statistics') {
      return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '30px' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>URL Statistics</h2>
            
            {manager.getAllActiveUrls().length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p style={{ marginBottom: '10px' }}>No active URLs found.</p>
                <p style={{ fontSize: '14px' }}>Create some URLs first to see statistics here.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9f9f9' }}>
                      <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Shortcode</th>
                      <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Original URL</th>
                      <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Short URL</th>
                      <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Created</th>
                      <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Expires</th>
                      <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Clicks</th>
                      <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manager.getAllActiveUrls().map((url) => (
                      <tr key={url.id} style={{ ':hover': { background: '#f5f5f5' } }}>
                        <td style={{ border: '1px solid #ddd', padding: '12px', fontFamily: 'monospace', background: '#f3f4f6' }}>{url.shortcode}</td>
                        <td style={{ border: '1px solid #ddd', padding: '12px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a href={url.originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                            {url.originalUrl}
                          </a>
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#10b981' }}>
                              localhost:3000/{url.shortcode}
                            </span>
                            <button
                              onClick={() => copyToClipboard(`http://localhost:3000/${url.shortcode}`)}
                              style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px' }}>
                          {new Date(url.created).toLocaleString()}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', color: '#dc2626' }}>
                          {new Date(url.expires).toLocaleString()}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '12px', fontWeight: 'bold' }}>
                          {url.clicks}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '12px' }}>
                          <button
                            onClick={() => handleShortUrlClick(url.shortcode, url.originalUrl)}
                            style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Visit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div style={{ textAlign: 'center', marginTop: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '6px' }}>
                  <p style={{ fontSize: '14px', color: '#666' }}>
                    Total URLs: {manager.getAllActiveUrls().length} | 
                    Total Clicks: {manager.getAllActiveUrls().reduce((sum, url) => sum + url.clicks, 0)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Home page
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        {/* Debug Section - Remove this in production */}
        <div style={{ background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '6px', padding: '15px', marginBottom: '20px' }}>
          <h4 style={{ color: '#856404', marginBottom: '10px' }}>🐛 Debug Info (Check this if URLs don't work):</h4>
          <div style={{ fontSize: '14px', color: '#856404' }}>
            <p><strong>Current Path:</strong> {currentPath}</p>
            <p><strong>Current Page:</strong> {page}</p>
            <p><strong>Total URLs in Database:</strong> {window.urlDatabase ? window.urlDatabase.length : 0}</p>
            <p><strong>Active URLs:</strong> {manager.getAllActiveUrls().length}</p>
            {window.urlDatabase && window.urlDatabase.length > 0 && (
              <div>
                <p><strong>All Shortcodes:</strong></p>
                <ul style={{ marginLeft: '20px' }}>
                  {window.urlDatabase.map((url, i) => (
                    <li key={i}>
                      <code>{url.shortcode}</code> → {url.originalUrl} 
                      {manager.isExpired(url) ? ' (EXPIRED)' : ' (ACTIVE)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#6c757d' }}>
              <strong>How to test:</strong> 1) Create a URL below, 2) Copy the generated short URL, 3) Paste in new browser tab
            </p>
          </div>
        </div>

        {/* URL Creation Form */}
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '30px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>Create Short URLs (Up to 5)</h2>
          
          {urls.map((urlData, index) => (
            <div key={index} style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '15px', marginBottom: '15px', background: '#f9f9f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ color: '#666', fontWeight: 'bold' }}>URL #{index + 1}</h3>
                {urls.length > 1 && (
                  <button
                    onClick={() => removeUrlField(index)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={urlData.url}
                  onChange={(e) => updateUrlField(index, 'url', e.target.value)}
                  style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
                />
                <input
                  type="number"
                  placeholder="30"
                  value={urlData.minutes}
                  onChange={(e) => updateUrlField(index, 'minutes', e.target.value)}
                  min="1"
                  style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
                />
                <input
                  type="text"
                  placeholder="custom-code"
                  value={urlData.code}
                  onChange={(e) => updateUrlField(index, 'code', e.target.value)}
                  maxLength="10"
                  style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
                />
              </div>
              
              {errors[index] && (
                <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '5px' }}>
                  {errors[index]}
                </div>
              )}
            </div>
          ))}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            {urls.length < 5 && (
              <button
                onClick={addUrlField}
                style={{ padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Add URL ({urls.length}/5)
              </button>
            )}
            
            <button
              onClick={createShortUrls}
              disabled={loading}
              style={{ 
                padding: '10px 24px', 
                background: loading ? '#9ca3af' : '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {loading ? 'Creating...' : 'Create Short URLs'}
            </button>
          </div>
        </div>

        {/* Results Display */}
        {results.length > 0 && (
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '30px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: '#333' }}>Created Short URLs</h3>
            
            {results.map((result) => (
              <div key={result.id} style={{ border: '1px solid #10b981', borderRadius: '6px', padding: '20px', marginBottom: '15px', background: '#f0fdf4' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#666', fontSize: '14px', marginBottom: '5px' }}>Original URL:</div>
                    <div style={{ fontSize: '14px', color: '#2563eb', wordBreak: 'break-all' }}>
                      <a href={result.originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                        {result.originalUrl}
                      </a>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#666', fontSize: '14px', marginBottom: '5px' }}>Short URL:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => {
                          logger.info('Short URL button clicked', { shortcode: result.shortcode });
                          const fullUrl = `http://localhost:3000/${result.shortcode}`;
                          
                          // For demo - show what would happen
                          const action = window.confirm(
                            `Short URL: ${fullUrl}\n\n` +
                            `This would redirect to: ${result.originalUrl}\n\n` +
                            `Click OK to open in new tab, Cancel to copy URL instead`
                          );
                          
                          if (action) {
                            manager.incrementClicks(result.shortcode);
                            window.open(result.originalUrl, '_blank');
                          } else {
                            copyToClipboard(fullUrl);
                          }
                        }}
                        style={{ fontSize: '14px', fontFamily: 'monospace', color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        http://localhost:3000/{result.shortcode}
                      </button>
                      <button
                        onClick={() => copyToClipboard(`http://localhost:3000/${result.shortcode}`)}
                        style={{ padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#666', fontSize: '14px', marginBottom: '5px' }}>Expires:</div>
                    <div style={{ fontSize: '14px', color: '#dc2626' }}>
                      {new Date(result.expires).toLocaleString()}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#666', fontSize: '14px', marginBottom: '5px' }}>Shortcode:</div>
                    <span style={{ fontSize: '14px', fontFamily: 'monospace', background: '#e5e7eb', padding: '4px 8px', borderRadius: '4px' }}>
                      {result.shortcode}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'Arial, sans-serif' }}>
      {/* Navigation */}
      <nav style={{ background: '#2563eb', color: 'white', padding: '15px 0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}> URL Shortener</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleNavigation('home')}
              style={{
                background: page === 'home' ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: 'white',
                border: '1px solid transparent',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Home
            </button>
            <button
              onClick={() => handleNavigation('statistics')}
              style={{
                background: page === 'statistics' ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: 'white',
                border: '1px solid transparent',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Statistics
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ paddingTop: '20px', paddingBottom: '20px' }}>
        {renderPageContent()}
      </main>
    </div>
  );
}

export default App;