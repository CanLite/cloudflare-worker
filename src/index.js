const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/tiktok', '') || '/';
    
    // Rewrite root path to TikTok's feed
    const tiktokPath = path === '/' ? '/foryou' : path;
    
    const tiktokUrl = new URL(`https://www.tiktok.com${tiktokPath}${url.search}`);
    
    // Prepare headers
    const headers = new Headers(request.headers);
    headers.set('Host', tiktokUrl.hostname);
    headers.set('Referer', 'https://www.tiktok.com/');
    headers.set('User-Agent', DEFAULT_USER_AGENT);
    headers.set('Origin', 'https://www.tiktok.com');
    headers.set('X-Forwarded-For', headers.get('CF-Connecting-IP') || '');
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', 'https');
    
    // Remove cookies and security headers
    headers.delete('Cookie');
    headers.delete('Sec-Fetch-Dest');
    headers.delete('Sec-Fetch-Mode');
    headers.delete('Sec-Fetch-Site');

    try {
      const response = await fetch(tiktokUrl, {
        method: request.method,
        headers: headers,
        redirect: 'manual'
      });
      
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('Location') || '';
        if (location.includes('tiktok.com')) {
          const newLocation = location.replace(
            /https?:\/\/(www\.)?tiktok\.com/, 
            `${url.origin}/tiktok`
          );
          return Response.redirect(newLocation, 302);
        }
        return new Response(null, { status: response.status, headers: { Location: location } });
      }

      // Process response
      const newHeaders = new Headers(response.headers);
      newHeaders.delete('Content-Security-Policy');
      newHeaders.delete('Set-Cookie');
      newHeaders.delete('Strict-Transport-Security');
      
      // Rewrite HTML content
      const contentType = newHeaders.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        const body = await response.text();
        const rewrittenBody = body
          .replaceAll(/(https?:)?\/\/www\.tiktok\.com/g, `${url.origin}/tiktok`)
          .replaceAll(/(https?:)?\/\/tiktok\.com/g, `${url.origin}/tiktok`)
          .replaceAll('"/@', '"/tiktok/@')
          .replaceAll('href="/', `href="${url.origin}/tiktok/`)
          .replaceAll('src="/', `src="${url.origin}/tiktok/`);
        
        return new Response(rewrittenBody, {
          status: response.status,
          headers: newHeaders
        });
      }
      
      // Handle video streams
      if (contentType.includes('video/')) {
        newHeaders.set('Content-Disposition', 'inline');
      }
      
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
      
    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
}
