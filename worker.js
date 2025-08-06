export default {
  async fetch(request) {
    const url = new URL(request.url);
    const tiktokUrl = 'https://www.tiktok.com' + url.pathname.replace('/tiktok', '');
    
    const modifiedRequest = new Request(tiktokUrl, {
      headers: {
        'Host': 'www.tiktok.com',
        'Referer': 'https://www.tiktok.com/',
        'User-Agent': request.headers.get('User-Agent'),
        'X-Forwarded-For': request.headers.get('CF-Connecting-IP')
      }
    });

    const response = await fetch(modifiedRequest);
    const modifiedResponse = new Response(response.body, response);
    
    // Rewrite URLs in response
    const text = await modifiedResponse.text();
    const rewritten = text.replace(/https?:\/\/[^/]*tiktok\.com/g, `https://${url.host}/tiktok`);
    
    return new Response(rewritten, modifiedResponse);
  }
};
