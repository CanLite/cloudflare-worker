export default {
  async fetch(request, env) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const baseUrl = 'https://www.tiktok.com';
    
    const url = new URL(request.url);
    // Extract the TikTok path from the request URL
    const tiktokPath = url.pathname.replace(/^\/tiktok/, '') || '/';
    
    // Build the TikTok URL
    const tiktokUrl = new URL(tiktokPath + url.search, baseUrl);

    // Modify headers for TikTok
    const headers = new Headers(request.headers);
    headers.set('Host', tiktokUrl.hostname);
    headers.set('Referer', baseUrl + '/');
    headers.set('User-Agent', userAgent);
    headers.set('Origin', baseUrl);
    headers.delete('Cookie'); // Remove cookies to prevent session issues
    
    // Add X-Forwarded headers
    headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', 'https');

    const modifiedRequest = new Request(tiktokUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual' // Handle redirects manually
    });

    try {
      const response = await fetch(modifiedRequest);
      
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('Location') || '';
        if (location.includes('tiktok.com')) {
          // Rewrite TikTok redirects to our proxy
          const newLocation = location.replace(
            /https?:\/\/(www\.)?tiktok\.com/, 
            `${url.origin}/tiktok`
          );
          return Response.redirect(newLocation, 302);
        }
        return Response.redirect(location, response.status);
      }

      // Create new headers for our response
      const newHeaders = new Headers(response.headers);
      newHeaders.delete('Content-Security-Policy');
      newHeaders.delete('Set-Cookie');
      newHeaders.delete('Strict-Transport-Security');
      
      // Rewrite response body for HTML content
      if (newHeaders.get('Content-Type')?.includes('text/html')) {
        const body = await response.text();
        const rewrittenBody = body
          .replaceAll('www.tiktok.com', url.host + '/tiktok')
          .replaceAll('tiktok.com', url.host + '/tiktok')
          .replaceAll('"//www.', `"//${url.host}/tiktok/`)
          .replaceAll('"/@', '"/tiktok/@');
        
        return new Response(rewrittenBody, {
          status: response.status,
          headers: newHeaders
        });
      }
      
      // Return other content types as-is
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
      
    } catch (error) {
      return new Response('Proxy error: ' + error.message, {status: 500});
    }
  }
};
